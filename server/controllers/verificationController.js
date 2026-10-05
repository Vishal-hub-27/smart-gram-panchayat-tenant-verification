const Verification = require('../models/Verification');
const FamilyMember = require('../models/FamilyMember');
const House = require('../models/House');
const Room = require('../models/Room');
const Owner = require('../models/Owner');
const ResidenceHistory = require('../models/ResidenceHistory');

const { success, error } = require('../utils/response');
const { generateId } = require('../services/idGeneratorService');
const { hasAvailableSpace } = require('../utils/roomRules');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { getSubjectModel, getOccupantCount } = require('./residenceHelpers');
const notify = require('../services/notificationService');
const audit = require('../services/auditService');
const subjectLabel = (s) => s.name || s.headName;
const ownerPath = (type, id) => `/owner/${type === 'tenant' ? 'tenants' : 'families'}/${id}`;

// ---------------------------------------------------------------------
// GET /api/verifications/pending  (admin only)
// Applications actively awaiting a decision — spec §11's queue.
// ---------------------------------------------------------------------
async function getPendingQueue(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { status: { $in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } };

    if (req.query.subjectType) filter.subjectType = req.query.subjectType;

    const [entries, total] = await Promise.all([
      Verification.find(filter)
        .populate('ownerId', 'ownerId name village')
        .populate('houseId', 'houseId address village')
        .sort({ createdAt: 1 }) // oldest first — first come, first reviewed
        .skip(skip)
        .limit(limit),
      Verification.countDocuments(filter),
    ]);

    // Attach a light-touch preview of the subject (name + duplicate flag)
    // without a heavier populate, since subjectId isn't a real Mongoose ref.
    const withPreview = await Promise.all(
      entries.map(async (entry) => {
        const Model = getSubjectModel(entry.subjectType);
        const subject = await Model.findById(entry.subjectId).select(
          entry.subjectType === 'tenant' ? 'name phone duplicateFlags' : 'headName headPhone duplicateFlags'
        );
        return {
          ...entry.toObject(),
          subjectPreview: subject
            ? {
                name: subject.name || subject.headName,
                phone: subject.phone || subject.headPhone,
                hasDuplicateFlag: (subject.duplicateFlags || []).length > 0,
              }
            : null,
        };
      })
    );

    return success(res, 200, 'Pending verification queue fetched.', {
      entries: withPreview,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/verifications/:id  (admin only)
// Full detail for the split verification screen (spec §26): application
// details, owner, house, room, documents, duplicate warnings.
// ---------------------------------------------------------------------
async function getVerificationById(req, res, next) {
  try {
    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return error(res, 404, 'Verification record not found.');
    }

    const Model = getSubjectModel(verification.subjectType);
    const subject = await Model.findById(verification.subjectId);
    if (!subject) {
      return error(res, 404, 'The application this verification refers to no longer exists.');
    }

    const [owner, house, room, members] = await Promise.all([
      Owner.findById(verification.ownerId),
      House.findById(verification.houseId),
      Room.findById(subject.roomId),
      verification.subjectType === 'family' ? FamilyMember.find({ familyId: subject._id }) : Promise.resolve(null),
    ]);

    return success(res, 200, 'Verification fetched.', {
      verification,
      subject,
      members,
      owner,
      house,
      room,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/verifications/:id/approve  (admin only)
// Re-checks capacity (state may have changed since submission), generates
// the permanent Tenant/Family ID (spec §12 — only ever happens here),
// increments room occupancy, and activates the record.
// ---------------------------------------------------------------------
async function approveVerification(req, res, next) {
  try {
    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return error(res, 404, 'Verification record not found.');
    }
    if (verification.status === 'APPROVED' || verification.status === 'REJECTED') {
      return error(res, 400, 'This application has already been resolved.');
    }

    const Model = getSubjectModel(verification.subjectType);
    const subject = await Model.findById(verification.subjectId);
    if (!subject) {
      return error(res, 404, 'The application this verification refers to no longer exists.');
    }

    const room = await Room.findById(subject.roomId);
    if (!room) {
      return error(res, 404, 'The room for this application no longer exists.');
    }

    const occupantCount = await getOccupantCount(verification.subjectType, subject);

    // Rule 3, re-checked here rather than trusted from submission time —
    // other approvals may have filled the room since this application
    // was submitted.
    if (!hasAvailableSpace(room.capacity, room.currentOccupancy, occupantCount)) {
      return error(
        res,
        400,
        'This room no longer has enough space for this application. Ask the owner to choose a different room, or reject/request correction.'
      );
    }

    const newId = await generateId(verification.subjectType === 'tenant' ? 'TENANT' : 'FAMILY');
    if (verification.subjectType === 'tenant') {
      subject.tenantId = newId;
    } else {
      subject.familyId = newId;
    }

    subject.status = 'ACTIVE';
    subject.statusHistory.push({ status: 'APPROVED', changedBy: req.user._id });
    subject.statusHistory.push({ status: 'ACTIVE', changedBy: req.user._id });
    await subject.save();

    room.currentOccupancy += occupantCount;
    await room.save();

    // Opens the subject's very first residence period (spec §16). Later
    // transfers/move-outs only ever close this or open the next one.
    await ResidenceHistory.create({
      subjectType: verification.subjectType,
      subjectId: subject._id,
      houseId: subject.houseId,
      roomId: subject.roomId,
      ownerId: verification.ownerId,
      fromDate: new Date(),
      toDate: null,
    });

    verification.status = 'APPROVED';
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();
    await verification.save();

    await audit.logAction({
      actor: req.user,
      action: `APPROVED_${verification.subjectType.toUpperCase()}`,
      targetType: verification.subjectType,
      targetId: newId,
      targetLabel: subjectLabel(subject),
      details: `Approved and activated; room occupancy +${occupantCount}.`,
    });
    await notify.notifyOwner(verification.ownerId, {
      type: 'APPLICATION_APPROVED',
      message: `${subjectLabel(subject)} was approved and is now active. ID: ${newId}.`,
      link: ownerPath(verification.subjectType, subject._id),
    });

    return success(res, 200, `Application approved. ${verification.subjectType === 'tenant' ? 'Tenant' : 'Family'} ID: ${newId}.`, {
      verification,
      subject,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/verifications/:id/reject  (admin only)
// Body: { reason }
// ---------------------------------------------------------------------
async function rejectVerification(req, res, next) {
  try {
    const { reason } = req.body;
    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return error(res, 404, 'Verification record not found.');
    }
    if (verification.status === 'APPROVED' || verification.status === 'REJECTED') {
      return error(res, 400, 'This application has already been resolved.');
    }

    const Model = getSubjectModel(verification.subjectType);
    const subject = await Model.findById(verification.subjectId);
    if (!subject) {
      return error(res, 404, 'The application this verification refers to no longer exists.');
    }

    subject.status = 'REJECTED';
    subject.statusHistory.push({ status: 'REJECTED', changedBy: req.user._id, note: reason || undefined });
    await subject.save();

    verification.status = 'REJECTED';
    verification.rejectionReason = reason || '';
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();
    await verification.save();

    await audit.logAction({
      actor: req.user,
      action: `REJECTED_${verification.subjectType.toUpperCase()}`,
      targetType: verification.subjectType,
      targetId: subject._id,
      targetLabel: subjectLabel(subject),
      details: reason || 'No reason given.',
    });
    await notify.notifyOwner(verification.ownerId, {
      type: 'APPLICATION_REJECTED',
      message: `The application for ${subjectLabel(subject)} was rejected.${reason ? ' Reason: ' + reason : ''}`,
      link: ownerPath(verification.subjectType, subject._id),
    });

    return success(res, 200, 'Application rejected.', { verification, subject });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/verifications/:id/correction  (admin only)
// Body: { notes: string[] }  — line-item issues, per spec §11 example
// ("Document image is unclear", "House address incomplete", ...).
// ---------------------------------------------------------------------
async function requestCorrection(req, res, next) {
  try {
    const { notes } = req.body;
    const noteList = Array.isArray(notes) ? notes.filter(Boolean) : [];

    if (noteList.length === 0) {
      return error(res, 400, 'Please provide at least one correction reason.');
    }

    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return error(res, 404, 'Verification record not found.');
    }
    if (verification.status === 'APPROVED' || verification.status === 'REJECTED') {
      return error(res, 400, 'This application has already been resolved.');
    }

    const Model = getSubjectModel(verification.subjectType);
    const subject = await Model.findById(verification.subjectId);
    if (!subject) {
      return error(res, 404, 'The application this verification refers to no longer exists.');
    }

    subject.status = 'CORRECTION_REQUIRED';
    subject.statusHistory.push({
      status: 'CORRECTION_REQUIRED',
      changedBy: req.user._id,
      note: noteList.join('\n'),
    });
    await subject.save();

    verification.status = 'CORRECTION_REQUIRED';
    verification.correctionNotes = noteList;
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();
    await verification.save();

    await audit.logAction({
      actor: req.user,
      action: `CORRECTION_REQUESTED_${verification.subjectType.toUpperCase()}`,
      targetType: verification.subjectType,
      targetId: subject._id,
      targetLabel: subjectLabel(subject),
      details: noteList.join('; '),
    });
    await notify.notifyOwner(verification.ownerId, {
      type: 'CORRECTION_REQUIRED',
      message: `Correction needed for ${subjectLabel(subject)}: ${noteList.join('; ')}`,
      link: ownerPath(verification.subjectType, subject._id),
    });

    return success(res, 200, 'Correction requested. The owner will see this on their application.', {
      verification,
      subject,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPendingQueue,
  getVerificationById,
  approveVerification,
  rejectVerification,
  requestCorrection,
};
