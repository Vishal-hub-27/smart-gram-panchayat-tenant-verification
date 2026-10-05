const Tenant = require('../models/Tenant');
const House = require('../models/House');
const Room = require('../models/Room');

const { success, error } = require('../utils/response');
const { requireOwnerProfile } = require('./houseController');
const { requireOwnedHouseAndRoom } = require('./residenceHelpers');
const { findPossibleDuplicates } = require('../services/duplicateCheckService');
const { hasAvailableSpace } = require('../utils/roomRules');
const { buildFileUrl, sanitizeFileLabel } = require('../utils/fileUrl');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { normalizePhone } = require('../utils/validators');
const { upsertVerification } = require('../services/verificationQueueService');
const notify = require('../services/notificationService');
const audit = require('../services/auditService');

/**
 * duplicateCheck lives in controllers/duplicateController.js — shared
 * between tenant and family routes since both need the same phone-based
 * matching logic (see services/duplicateCheckService.js).
 */

// ---------------------------------------------------------------------
// POST /api/tenants  (owner only)
// Multipart form: photo (single), documents (up to 5) + tenant fields.
// Server re-runs the duplicate check regardless of what the frontend did —
// a direct API call must not be able to skip the warning. If duplicates
// exist, the client must resend with duplicateAcknowledged=true.
// ---------------------------------------------------------------------
async function createTenant(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const {
      houseId,
      roomId,
      name,
      phone,
      alternatePhone,
      dateOfBirth,
      gender,
      education,
      permanentAddress,
      currentResidence,
      employer,
      duplicateAcknowledged,
    } = req.body;

    const cleanPhone = normalizePhone(phone);

    const duplicates = await findPossibleDuplicates(cleanPhone);
    if (duplicates.length > 0 && duplicateAcknowledged !== 'true' && duplicateAcknowledged !== true) {
      return success(res, 200, 'A possible existing tenant record was found. Please review before continuing.', {
        possibleDuplicate: true,
        matches: duplicates,
        created: false,
      });
    }

    const { room } = await requireOwnedHouseAndRoom(owner._id, houseId, roomId);

    if (!hasAvailableSpace(room.capacity, room.currentOccupancy, 1)) {
      return error(res, 400, 'This room has reached its maximum capacity. Please select another room.');
    }

    const photoFile = req.files?.photo?.[0];
    const documentFiles = req.files?.documents || [];

    const tenant = await Tenant.create({
      ownerId: owner._id,
      houseId: room.houseId,
      roomId: room._id,
      name,
      phone: cleanPhone,
      alternatePhone: alternatePhone ? normalizePhone(alternatePhone) : undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || '',
      education,
      permanentAddress,
      currentResidence,
      employer,
      photoUrl: photoFile ? buildFileUrl(photoFile) : null,
      documents: documentFiles.map((f) => ({ label: sanitizeFileLabel(f.originalname), url: buildFileUrl(f) })),
      // If duplicates were found and the owner proceeded anyway, record
      // exactly what was flagged so an admin reviewing this later isn't
      // starting from zero — see the model comment for why this matters.
      duplicateFlags: duplicates.map((d) => ({
        recordType: d.recordType,
        matchedId: d.id,
        name: d.name,
        status: d.status,
      })),
      status: 'SUBMITTED',
      statusHistory: [{ status: 'SUBMITTED', changedBy: req.user._id }],
    });

    await upsertVerification({
      subjectType: 'tenant',
      subjectId: tenant._id,
      ownerId: owner._id,
      houseId: room.houseId,
      status: 'SUBMITTED',
    });

    await notify.notifyOwner(owner._id, {
      type: 'APPLICATION_SUBMITTED',
      message: `Your application for ${tenant.name} was submitted and is awaiting admin review.`,
      link: `/owner/tenants/${tenant._id}`,
    });
    await notify.notifyAdmins({
      type: 'NEW_APPLICATION',
      message: `New tenant application: ${tenant.name}.`,
      link: '/admin/verifications',
    });

    return success(res, 201, 'Tenant application submitted. It is now pending admin verification.', {
      tenant,
      created: true,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/tenants  (owner -> own tenants; admin -> all, with filters)
// ---------------------------------------------------------------------
async function getTenants(req, res, next) {
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

    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .populate('houseId', 'houseId address village')
        .populate('roomId', 'roomId roomNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Tenant.countDocuments(filter),
    ]);

    return success(res, 200, 'Tenants fetched.', {
      tenants,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/tenants/:id  (Mongo _id — tenantId isn't assigned until approved)
// ---------------------------------------------------------------------
async function getTenantById(req, res, next) {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return error(res, 404, 'Tenant record not found.');
    }

    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      if (tenant.ownerId.toString() !== owner._id.toString()) {
        return error(res, 404, 'Tenant record not found.');
      }
    }

    const [house, room] = await Promise.all([House.findById(tenant.houseId), Room.findById(tenant.roomId)]);

    return success(res, 200, 'Tenant fetched.', { tenant, house, room });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// PUT /api/tenants/:id  (owner, own tenant, only while CORRECTION_REQUIRED)
// Lets the owner fix flagged issues and resubmit for re-review, closing
// the loop from spec §11: CORRECTION_REQUIRED -> Owner Updates -> Resubmit
// -> Re-verify. Only fields relevant to a correction are editable — an
// active/approved tenant can't be silently rewritten through this route.
// ---------------------------------------------------------------------
async function resubmitTenant(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return error(res, 404, 'Tenant record not found.');
    }
    if (tenant.ownerId.toString() !== owner._id.toString()) {
      return error(res, 404, 'Tenant record not found.');
    }
    if (tenant.status !== 'CORRECTION_REQUIRED') {
      return error(res, 400, 'This application is not currently awaiting correction.');
    }

    const {
      name,
      phone,
      alternatePhone,
      dateOfBirth,
      gender,
      education,
      permanentAddress,
      currentResidence,
      employer,
      houseId,
      roomId,
    } = req.body;

    // Residence can optionally change on resubmission (e.g. correction was
    // "please pick a different room") — re-validate ownership/capacity
    // exactly like initial submission if it did.
    let targetRoom = null;
    if (houseId && roomId) {
      const resolved = await requireOwnedHouseAndRoom(owner._id, houseId, roomId);
      targetRoom = resolved.room;
      const roomChanged = targetRoom._id.toString() !== tenant.roomId.toString();
      if (roomChanged && !hasAvailableSpace(targetRoom.capacity, targetRoom.currentOccupancy, 1)) {
        return error(res, 400, 'This room has reached its maximum capacity. Please select another room.');
      }
    }

    if (name !== undefined) tenant.name = name;
    if (phone !== undefined) tenant.phone = normalizePhone(phone);
    if (alternatePhone !== undefined) tenant.alternatePhone = normalizePhone(alternatePhone);
    if (dateOfBirth !== undefined) tenant.dateOfBirth = dateOfBirth || undefined;
    if (gender !== undefined) tenant.gender = gender;
    if (education !== undefined) tenant.education = education;
    if (permanentAddress !== undefined) tenant.permanentAddress = permanentAddress;
    if (currentResidence !== undefined) tenant.currentResidence = currentResidence;
    if (employer !== undefined) tenant.employer = employer;
    if (targetRoom) {
      tenant.houseId = targetRoom.houseId;
      tenant.roomId = targetRoom._id;
    }

    const photoFile = req.files?.photo?.[0];
    const documentFiles = req.files?.documents || [];
    if (photoFile) tenant.photoUrl = buildFileUrl(photoFile);
    if (documentFiles.length > 0) {
      tenant.documents = documentFiles.map((f) => ({ label: sanitizeFileLabel(f.originalname), url: buildFileUrl(f) }));
    }

    tenant.status = 'RESUBMITTED';
    tenant.statusHistory.push({
      status: 'RESUBMITTED',
      changedBy: req.user._id,
      note: 'Owner updated the application and resubmitted for review.',
    });
    await tenant.save();

    await upsertVerification({
      subjectType: 'tenant',
      subjectId: tenant._id,
      ownerId: owner._id,
      houseId: tenant.houseId,
      status: 'RESUBMITTED',
    });

    await notify.notifyAdmins({
      type: 'APPLICATION_RESUBMITTED',
      message: `Resubmitted after correction: tenant ${tenant.name}.`,
      link: '/admin/verifications',
    });

    return success(res, 200, 'Application updated and resubmitted for admin review.', tenant);
  } catch (err) {
    next(err);
  }
}

module.exports = { createTenant, getTenants, getTenantById, resubmitTenant };
