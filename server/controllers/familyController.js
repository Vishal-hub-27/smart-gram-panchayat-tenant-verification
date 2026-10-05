const Family = require('../models/Family');
const FamilyMember = require('../models/FamilyMember');
const House = require('../models/House');
const Room = require('../models/Room');

const { success, error } = require('../utils/response');
const { requireOwnerProfile } = require('./houseController');
const { requireOwnedHouseAndRoom } = require('./residenceHelpers');
const { findPossibleDuplicates } = require('../services/duplicateCheckService');
const { hasAvailableSpace } = require('../utils/roomRules');
const { buildFileUrl, sanitizeFileLabel } = require('../utils/fileUrl');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { normalizePhone, isValidOtp } = require('../utils/validators');
const otpService = require('../services/otpService');
const { upsertVerification } = require('../services/verificationQueueService');
const notify = require('../services/notificationService');
const audit = require('../services/auditService');
const { config } = require('../config/env');

const MAX_HEAD_OTP_ATTEMPTS = 5;
const HEAD_OTP_CLAIM_WINDOW_MINUTES = 10;

function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  return `${phone.slice(0, 2)}${'*'.repeat(phone.length - 4)}${phone.slice(-2)}`;
}

async function lookupFamily(req, res, next) {
  try {
    const family = await Family.findOne({ familyId: req.params.familyId });
    if (!family) {
      return error(res, 404, 'No family found with this ID.');
    }
    const memberCount = await FamilyMember.countDocuments({ familyId: family._id });
    return success(res, 200, 'Family found.', {
      familyId: family.familyId,
      headName: family.headName,
      maskedPhone: maskPhone(family.headPhone),
      status: family.status,
      memberCount,
    });
  } catch (err) {
    next(err);
  }
}

async function sendHeadOtp(req, res, next) {
  try {
    const family = await Family.findOne({ familyId: req.params.familyId });
    if (!family) {
      return error(res, 404, 'No family found with this ID.');
    }
    const otp = otpService.generateOtp();
    family.headOtpHash = await otpService.hashOtp(otp);
    family.headOtpExpiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);
    family.headOtpAttempts = 0;
    await family.save();
    await otpService.sendOtp(family.headPhone, otp);
    const payload = { familyId: family.familyId };
    if (!config.isProduction) {
      payload.devOtp = otp;
    }
    return success(res, 200, "An OTP has been sent to the family head's registered phone.", payload);
  } catch (err) {
    next(err);
  }
}

async function verifyHeadOtp(req, res, next) {
  try {
    const { otp } = req.body;
    if (!isValidOtp(otp)) {
      return error(res, 400, 'Please enter the 6-digit OTP.');
    }
    const family = await Family.findOne({ familyId: req.params.familyId }).select(
      '+headOtpHash +headOtpExpiresAt +headOtpAttempts'
    );
    if (!family) {
      return error(res, 404, 'No family found with this ID.');
    }
    if (!family.headOtpExpiresAt || family.headOtpExpiresAt.getTime() < Date.now()) {
      return error(res, 400, 'This OTP has expired. Please request a new one.');
    }
    if (family.headOtpAttempts >= MAX_HEAD_OTP_ATTEMPTS) {
      return error(res, 429, 'Too many incorrect attempts. Please request a new OTP.');
    }
    const isMatch = await otpService.compareOtp(otp, family.headOtpHash);
    if (!isMatch) {
      family.headOtpAttempts += 1;
      await family.save();
      return error(res, 400, 'Incorrect OTP. Please try again.');
    }
    family.isHeadPhoneVerified = true;
    family.headOtpVerifiedAt = new Date();
    family.headOtpHash = undefined;
    family.headOtpExpiresAt = undefined;
    family.headOtpAttempts = 0;
    await family.save();
    const [members, house, room] = await Promise.all([
      FamilyMember.find({ familyId: family._id }),
      House.findById(family.houseId).select('houseId address village'),
      Room.findById(family.roomId).select('roomId roomNumber'),
    ]);
    return success(res, 200, 'Phone verified. Showing existing family record.', {
      family,
      members,
      currentResidence: { house, room },
    });
  } catch (err) {
    next(err);
  }
}

async function updateResidence(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const family = await Family.findOne({ familyId: req.params.familyId }).select('+headOtpVerifiedAt');
    if (!family) {
      return error(res, 404, 'No family found with this ID.');
    }
    const verifiedRecently =
      family.headOtpVerifiedAt &&
      Date.now() - family.headOtpVerifiedAt.getTime() < HEAD_OTP_CLAIM_WINDOW_MINUTES * 60 * 1000;
    if (!verifiedRecently) {
      return error(res, 403, 'Phone verification required before updating residence. Please verify the OTP again.');
    }
    const { houseId, roomId, headName, alternatePhone } = req.body;
    const { room } = await requireOwnedHouseAndRoom(owner._id, houseId, roomId);
    const memberCount = await FamilyMember.countDocuments({ familyId: family._id });
    const isSameRoom = family.roomId.toString() === room._id.toString();
    if (!isSameRoom && !hasAvailableSpace(room.capacity, room.currentOccupancy, 1 + memberCount)) {
      return error(res, 400, 'This room has reached its maximum capacity. Please select another room.');
    }
    family.ownerId = owner._id;
    family.houseId = room.houseId;
    family.roomId = room._id;
    if (headName) family.headName = headName;
    if (alternatePhone) family.alternatePhone = normalizePhone(alternatePhone);
    family.status = 'SUBMITTED';
    family.statusHistory.push({
      status: 'SUBMITTED',
      changedBy: req.user._id,
      note: 'Residence updated via existing-family claim flow.',
    });
    family.headOtpVerifiedAt = undefined;
    await family.save();

    await upsertVerification({
      subjectType: 'family',
      subjectId: family._id,
      ownerId: owner._id,
      houseId: family.houseId,
      status: 'SUBMITTED',
    });

    await notify.notifyOwner(owner._id, {
      type: 'APPLICATION_SUBMITTED',
      message: `The ${family.headName} family's residence update was submitted for admin review.`,
      link: `/owner/families/${family._id}`,
    });
    await notify.notifyAdmins({
      type: 'NEW_APPLICATION',
      message: `Existing family relocated and awaiting review: ${family.headName}.`,
      link: '/admin/verifications',
    });

    return success(res, 200, 'Residence updated. Submitted for admin review.', family);
  } catch (err) {
    next(err);
  }
}

async function createFamily(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const { houseId, roomId, headName, headPhone, alternatePhone, duplicateAcknowledged } = req.body;

    let members = [];
    if (req.body.members) {
      try {
        members = JSON.parse(req.body.members);
      } catch {
        return error(res, 400, 'Invalid family member data.');
      }
    }
    for (const m of members) {
      if (!m.name || !m.relationship) {
        return error(res, 400, 'Each family member needs a name and relationship.');
      }
    }

    const cleanPhone = normalizePhone(headPhone);
    const duplicates = await findPossibleDuplicates(cleanPhone);
    if (duplicates.length > 0 && duplicateAcknowledged !== 'true' && duplicateAcknowledged !== true) {
      return success(res, 200, 'A possible existing record was found. Please review before continuing.', {
        possibleDuplicate: true,
        matches: duplicates,
        created: false,
      });
    }

    const { room } = await requireOwnedHouseAndRoom(owner._id, houseId, roomId);
    const occupantCount = 1 + members.length;
    if (!hasAvailableSpace(room.capacity, room.currentOccupancy, occupantCount)) {
      return error(
        res,
        400,
        `This room does not have enough space for ${occupantCount} people. Please select another room.`
      );
    }

    const headPhotoFile = req.files?.headPhoto?.[0];
    const documentFiles = req.files?.documents || [];

    const family = await Family.create({
      ownerId: owner._id,
      houseId: room.houseId,
      roomId: room._id,
      headName,
      headPhone: cleanPhone,
      alternatePhone: alternatePhone ? normalizePhone(alternatePhone) : undefined,
      headPhotoUrl: headPhotoFile ? buildFileUrl(headPhotoFile) : null,
      documents: documentFiles.map((f) => ({ label: sanitizeFileLabel(f.originalname), url: buildFileUrl(f) })),
      duplicateFlags: duplicates.map((d) => ({
        recordType: d.recordType,
        matchedId: d.id,
        name: d.name,
        status: d.status,
      })),
      status: 'SUBMITTED',
      statusHistory: [{ status: 'SUBMITTED', changedBy: req.user._id }],
    });

    const createdMembers = await FamilyMember.insertMany(
      members.map((m) => ({
        familyId: family._id,
        name: m.name,
        relationship: m.relationship,
        age: m.age || undefined,
        gender: m.gender || '',
      }))
    );

    await upsertVerification({
      subjectType: 'family',
      subjectId: family._id,
      ownerId: owner._id,
      houseId: room.houseId,
      status: 'SUBMITTED',
    });

    await notify.notifyOwner(owner._id, {
      type: 'APPLICATION_SUBMITTED',
      message: `Your application for the ${headName} family was submitted and is awaiting admin review.`,
      link: `/owner/families/${family._id}`,
    });
    await notify.notifyAdmins({
      type: 'NEW_APPLICATION',
      message: `New family application: ${headName}.`,
      link: '/admin/verifications',
    });

    return success(res, 201, 'Family application submitted. It is now pending admin verification.', {
      family,
      members: createdMembers,
      created: true,
    });
  } catch (err) {
    next(err);
  }
}

async function getFamilies(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      filter.ownerId = owner._id;
      if (req.query.status) filter.status = req.query.status;
    } else {
      if (req.query.ownerId) filter.ownerId = req.query.ownerId;
      if (req.query.status) filter.status = req.query.status;
    }
    const [families, total] = await Promise.all([
      Family.find(filter)
        .populate('houseId', 'houseId address village')
        .populate('roomId', 'roomId roomNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Family.countDocuments(filter),
    ]);
    return success(res, 200, 'Families fetched.', {
      families,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

async function getFamilyById(req, res, next) {
  try {
    const family = await Family.findById(req.params.id);
    if (!family) {
      return error(res, 404, 'Family record not found.');
    }
    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      if (family.ownerId.toString() !== owner._id.toString()) {
        return error(res, 404, 'Family record not found.');
      }
    }
    const [members, house, room] = await Promise.all([
      FamilyMember.find({ familyId: family._id }),
      House.findById(family.houseId),
      Room.findById(family.roomId),
    ]);
    return success(res, 200, 'Family fetched.', { family, members, house, room });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// PUT /api/families/:id  (owner, own family, only while CORRECTION_REQUIRED)
// Mirrors tenantController.resubmitTenant — lets the owner fix flagged
// issues (head details, residence, member list, documents) and resubmit.
// Member list is fully replaced when provided rather than diffed
// member-by-member — simpler and sufficient for a correction pass; a more
// granular per-member edit UI isn't needed at this stage.
// ---------------------------------------------------------------------
async function resubmitFamily(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const family = await Family.findById(req.params.id);

    if (!family) {
      return error(res, 404, 'Family record not found.');
    }
    if (family.ownerId.toString() !== owner._id.toString()) {
      return error(res, 404, 'Family record not found.');
    }
    if (family.status !== 'CORRECTION_REQUIRED') {
      return error(res, 400, 'This application is not currently awaiting correction.');
    }

    const { headName, headPhone, alternatePhone, houseId, roomId } = req.body;

    let members;
    if (req.body.members) {
      try {
        members = JSON.parse(req.body.members);
      } catch {
        return error(res, 400, 'Invalid family member data.');
      }
      for (const m of members) {
        if (!m.name || !m.relationship) {
          return error(res, 400, 'Each family member needs a name and relationship.');
        }
      }
    }

    let targetRoom = null;
    if (houseId && roomId) {
      const resolved = await requireOwnedHouseAndRoom(owner._id, houseId, roomId);
      targetRoom = resolved.room;
      const roomChanged = targetRoom._id.toString() !== family.roomId.toString();
      const occupantCount = 1 + (members ? members.length : await FamilyMember.countDocuments({ familyId: family._id }));
      if (roomChanged && !hasAvailableSpace(targetRoom.capacity, targetRoom.currentOccupancy, occupantCount)) {
        return error(res, 400, 'This room has reached its maximum capacity. Please select another room.');
      }
    }

    if (headName !== undefined) family.headName = headName;
    if (headPhone !== undefined) family.headPhone = normalizePhone(headPhone);
    if (alternatePhone !== undefined) family.alternatePhone = normalizePhone(alternatePhone);
    if (targetRoom) {
      family.houseId = targetRoom.houseId;
      family.roomId = targetRoom._id;
    }

    const headPhotoFile = req.files?.headPhoto?.[0];
    const documentFiles = req.files?.documents || [];
    if (headPhotoFile) family.headPhotoUrl = buildFileUrl(headPhotoFile);
    if (documentFiles.length > 0) {
      family.documents = documentFiles.map((f) => ({ label: sanitizeFileLabel(f.originalname), url: buildFileUrl(f) }));
    }

    family.status = 'RESUBMITTED';
    family.statusHistory.push({
      status: 'RESUBMITTED',
      changedBy: req.user._id,
      note: 'Owner updated the application and resubmitted for review.',
    });
    await family.save();

    if (members) {
      await FamilyMember.deleteMany({ familyId: family._id });
      await FamilyMember.insertMany(
        members.map((m) => ({
          familyId: family._id,
          name: m.name,
          relationship: m.relationship,
          age: m.age || undefined,
          gender: m.gender || '',
        }))
      );
    }

    await upsertVerification({
      subjectType: 'family',
      subjectId: family._id,
      ownerId: owner._id,
      houseId: family.houseId,
      status: 'RESUBMITTED',
    });

    await notify.notifyAdmins({
      type: 'APPLICATION_RESUBMITTED',
      message: `Resubmitted after correction: family ${family.headName}.`,
      link: '/admin/verifications',
    });

    return success(res, 200, 'Application updated and resubmitted for admin review.', family);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  lookupFamily,
  sendHeadOtp,
  verifyHeadOtp,
  updateResidence,
  createFamily,
  getFamilies,
  getFamilyById,
  resubmitFamily,
};
