const ResidenceRequest = require('../models/ResidenceRequest');
const ResidenceHistory = require('../models/ResidenceHistory');
const Room = require('../models/Room');

const { success, error } = require('../utils/response');
const { requireOwnerProfile } = require('./houseController');
const { requireOwnedHouseAndRoom, getSubjectModel, getOccupantCount } = require('./residenceHelpers');
const { hasAvailableSpace } = require('../utils/roomRules');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const notify = require('../services/notificationService');
const audit = require('../services/auditService');
const subjectLabel = (s) => s.name || s.headName;
const ownerPath = (type, id) => `/owner/${type === 'tenant' ? 'tenants' : 'families'}/${id}`;
const roomLabel = (r) => `${r.roomNumber} (${r.roomId})`;

/**
 * Loads the subject and confirms it belongs to the requesting owner and is
 * ACTIVE — transfer and move-out only apply to active residents (spec §13).
 */
async function requireActiveOwnedSubject(owner, subjectType, subjectId) {
  const Model = getSubjectModel(subjectType);
  const subject = await Model.findById(subjectId);
  if (!subject || subject.ownerId.toString() !== owner._id.toString()) {
    const err = new Error('Record not found.');
    err.statusCode = 404;
    throw err;
  }
  if (subject.status !== 'ACTIVE') {
    const err = new Error('Only active residents can be transferred or moved out.');
    err.statusCode = 400;
    throw err;
  }
  return subject;
}

// =========================== TRANSFER (spec §14) ===========================

// POST /api/transfers  (owner)
// Both source and destination must belong to the SAME requesting owner
// (requireOwnedHouseAndRoom). A tenant moving to a different owner's
// property has no identity-verification step in this system (unlike a
// family, which a new owner can claim via Phase 5's OTP flow), so
// cross-owner tenant transfer is intentionally out of scope.
async function createTransferRequest(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const { subjectType, subjectId, toHouseId, toRoomId, reason } = req.body;

    if (!['tenant', 'family'].includes(subjectType)) {
      return error(res, 400, 'Invalid subject type.');
    }

    const subject = await requireActiveOwnedSubject(owner, subjectType, subjectId);
    const { room: toRoom } = await requireOwnedHouseAndRoom(owner._id, toHouseId, toRoomId);

    if (toRoom._id.toString() === subject.roomId.toString()) {
      return error(res, 400, 'This is already the current room for this resident.');
    }

    const occupantCount = await getOccupantCount(subjectType, subject);
    if (!hasAvailableSpace(toRoom.capacity, toRoom.currentOccupancy, occupantCount)) {
      return error(res, 400, 'This room has reached its maximum capacity. Please select another room.');
    }

    const request = await ResidenceRequest.create({
      requestType: 'transfer',
      subjectType,
      subjectId: subject._id,
      ownerId: owner._id,
      fromHouseId: subject.houseId,
      fromRoomId: subject.roomId,
      toHouseId: toRoom.houseId,
      toRoomId: toRoom._id,
      reason,
      requestedBy: req.user._id,
    });

    await notify.notifyAdmins({
      type: 'TRANSFER_REQUESTED',
      message: `Transfer requested for ${subjectLabel(subject)}.`,
      link: '/admin/residence-requests',
    });

    return success(res, 201, 'Transfer requested. It is now pending admin approval.', request);
  } catch (err) {
    next(err);
  }
}

// GET /api/transfers  (owner -> own; admin -> all)
async function getTransferRequests(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { requestType: 'transfer' };

    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      filter.ownerId = owner._id;
    } else if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }
    if (req.query.status) filter.status = req.query.status;

    const [requests, total] = await Promise.all([
      ResidenceRequest.find(filter)
        .populate('fromHouseId', 'houseId address')
        .populate('toHouseId', 'houseId address')
        .populate('fromRoomId', 'roomId roomNumber')
        .populate('toRoomId', 'roomId roomNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ResidenceRequest.countDocuments(filter),
    ]);

    return success(res, 200, 'Transfer requests fetched.', {
      requests,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/transfers/:id/approve  (admin)
async function approveTransfer(req, res, next) {
  try {
    const request = await ResidenceRequest.findOne({ _id: req.params.id, requestType: 'transfer' });
    if (!request) return error(res, 404, 'Transfer request not found.');
    if (request.status !== 'PENDING') return error(res, 400, 'This request has already been resolved.');

    const Model = getSubjectModel(request.subjectType);
    const subject = await Model.findById(request.subjectId);
    if (!subject || subject.status !== 'ACTIVE') {
      return error(res, 400, 'This resident is no longer active; the transfer can no longer proceed.');
    }

    const [fromRoom, toRoom] = await Promise.all([
      Room.findById(request.fromRoomId),
      Room.findById(request.toRoomId),
    ]);
    if (!fromRoom || !toRoom) {
      return error(res, 404, 'One of the rooms for this transfer no longer exists.');
    }

    const occupantCount = await getOccupantCount(request.subjectType, subject);

    // Re-checked at approval, not trusted from request time (Rule 3).
    if (!hasAvailableSpace(toRoom.capacity, toRoom.currentOccupancy, occupantCount)) {
      return error(res, 400, 'The destination room no longer has enough space for this transfer.');
    }

    // Atomicity note (Rule 10, "where possible"): a true multi-document
    // transaction needs a MongoDB replica set, which a plain standalone
    // mongod (the common dev setup) doesn't provide. Writes are ordered so
    // nothing changes until the capacity check passes, keeping the window
    // for a half-applied transfer as small as possible without one.
    const now = new Date();

    await ResidenceHistory.findOneAndUpdate(
      { subjectType: request.subjectType, subjectId: subject._id, toDate: null },
      { toDate: now, endReason: 'transfer' }
    );

    fromRoom.currentOccupancy = Math.max(0, fromRoom.currentOccupancy - occupantCount);
    await fromRoom.save();

    toRoom.currentOccupancy += occupantCount;
    await toRoom.save();

    await ResidenceHistory.create({
      subjectType: request.subjectType,
      subjectId: subject._id,
      houseId: toRoom.houseId,
      roomId: toRoom._id,
      ownerId: request.ownerId,
      fromDate: now,
      toDate: null,
    });

    subject.houseId = toRoom.houseId;
    subject.roomId = toRoom._id;
    subject.statusHistory.push({
      status: 'ACTIVE',
      changedBy: req.user._id,
      note: 'Transferred to a new house/room.',
    });
    await subject.save();

    request.status = 'APPROVED';
    request.reviewedBy = req.user._id;
    request.reviewedAt = now;
    await request.save();

    await audit.logAction({
      actor: req.user,
      action: 'TRANSFER_APPROVED',
      targetType: 'transfer',
      targetId: request._id,
      targetLabel: subjectLabel(subject),
      details: `Moved from room ${roomLabel(fromRoom)} to ${roomLabel(toRoom)}.`,
    });
    await notify.notifyOwner(request.ownerId, {
      type: 'TRANSFER_APPROVED',
      message: `Transfer approved: ${subjectLabel(subject)} is now in room ${roomLabel(toRoom)}.`,
      link: ownerPath(request.subjectType, subject._id),
    });

    return success(res, 200, 'Transfer approved and completed.', { request, subject });
  } catch (err) {
    next(err);
  }
}

// POST /api/transfers/:id/reject  (admin)
async function rejectTransfer(req, res, next) {
  try {
    const request = await ResidenceRequest.findOne({ _id: req.params.id, requestType: 'transfer' });
    if (!request) return error(res, 404, 'Transfer request not found.');
    if (request.status !== 'PENDING') return error(res, 400, 'This request has already been resolved.');

    request.status = 'REJECTED';
    request.rejectionReason = req.body.reason || '';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    const rejSubject = await getSubjectModel(request.subjectType).findById(request.subjectId);
    const rejLabel = rejSubject ? subjectLabel(rejSubject) : 'the resident';
    await audit.logAction({
      actor: req.user,
      action: 'TRANSFER_REJECTED',
      targetType: 'transfer',
      targetId: request._id,
      targetLabel: rejLabel,
      details: request.rejectionReason || 'No reason given.',
    });
    await notify.notifyOwner(request.ownerId, {
      type: 'TRANSFER_REJECTED',
      message: `Transfer request for ${rejLabel} was rejected.${request.rejectionReason ? ' Reason: ' + request.rejectionReason : ''}`,
      link: rejSubject ? ownerPath(request.subjectType, rejSubject._id) : undefined,
    });

    return success(res, 200, 'Transfer request rejected.', request);
  } catch (err) {
    next(err);
  }
}

// ============================ MOVE-OUT (spec §15) ===========================

// POST /api/tenants/:id/move-out and /api/families/:id/move-out  (owner)
function createMoveOutHandler(subjectType) {
  return async function createMoveOutRequest(req, res, next) {
    try {
      const owner = await requireOwnerProfile(req);
      const { moveOutDate, reason } = req.body;
      const subject = await requireActiveOwnedSubject(owner, subjectType, req.params.id);

      const request = await ResidenceRequest.create({
        requestType: 'move_out',
        subjectType,
        subjectId: subject._id,
        ownerId: owner._id,
        fromHouseId: subject.houseId,
        fromRoomId: subject.roomId,
        moveOutDate: moveOutDate || new Date(),
        reason,
        requestedBy: req.user._id,
      });

      await notify.notifyAdmins({
        type: 'MOVE_OUT_REQUESTED',
        message: `Move-out requested for ${subjectLabel(subject)}.`,
        link: '/admin/residence-requests',
      });

      return success(res, 201, 'Move-out requested. It is now pending admin confirmation.', request);
    } catch (err) {
      next(err);
    }
  };
}

const createTenantMoveOutRequest = createMoveOutHandler('tenant');
const createFamilyMoveOutRequest = createMoveOutHandler('family');

// GET /api/move-outs  (admin)
async function getMoveOutRequests(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { requestType: 'move_out' };
    if (req.query.status) filter.status = req.query.status;

    const [requests, total] = await Promise.all([
      ResidenceRequest.find(filter)
        .populate('fromHouseId', 'houseId address')
        .populate('fromRoomId', 'roomId roomNumber')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      ResidenceRequest.countDocuments(filter),
    ]);

    return success(res, 200, 'Move-out requests fetched.', {
      requests,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/move-outs/:id/approve  (admin)
async function approveMoveOut(req, res, next) {
  try {
    const request = await ResidenceRequest.findOne({ _id: req.params.id, requestType: 'move_out' });
    if (!request) return error(res, 404, 'Move-out request not found.');
    if (request.status !== 'PENDING') return error(res, 400, 'This request has already been resolved.');

    const Model = getSubjectModel(request.subjectType);
    const subject = await Model.findById(request.subjectId);
    if (!subject || subject.status !== 'ACTIVE') {
      return error(res, 400, 'This resident is no longer active.');
    }

    const room = await Room.findById(request.fromRoomId);
    if (!room) return error(res, 404, 'The room for this request no longer exists.');

    const occupantCount = await getOccupantCount(request.subjectType, subject);
    const effectiveDate = request.moveOutDate || new Date();

    await ResidenceHistory.findOneAndUpdate(
      { subjectType: request.subjectType, subjectId: subject._id, toDate: null },
      { toDate: effectiveDate, endReason: 'move_out' }
    );

    room.currentOccupancy = Math.max(0, room.currentOccupancy - occupantCount);
    await room.save();

    subject.status = 'MOVED_OUT';
    subject.statusHistory.push({
      status: 'MOVED_OUT',
      changedBy: req.user._id,
      note: request.reason || undefined,
    });
    await subject.save();

    request.status = 'APPROVED';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    await audit.logAction({
      actor: req.user,
      action: 'MOVE_OUT_APPROVED',
      targetType: 'move_out',
      targetId: request._id,
      targetLabel: subjectLabel(subject),
      details: `Residence ended${request.reason ? ': ' + request.reason : '.'}`,
    });
    await notify.notifyOwner(request.ownerId, {
      type: 'MOVE_OUT_CONFIRMED',
      message: `${subjectLabel(subject)} was marked as moved out.`,
      link: ownerPath(request.subjectType, subject._id),
    });

    return success(res, 200, 'Move-out confirmed.', { request, subject });
  } catch (err) {
    next(err);
  }
}

// POST /api/move-outs/:id/reject  (admin)
async function rejectMoveOut(req, res, next) {
  try {
    const request = await ResidenceRequest.findOne({ _id: req.params.id, requestType: 'move_out' });
    if (!request) return error(res, 404, 'Move-out request not found.');
    if (request.status !== 'PENDING') return error(res, 400, 'This request has already been resolved.');

    request.status = 'REJECTED';
    request.rejectionReason = req.body.reason || '';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    const moSubject = await getSubjectModel(request.subjectType).findById(request.subjectId);
    const moLabel = moSubject ? subjectLabel(moSubject) : 'the resident';
    await audit.logAction({
      actor: req.user,
      action: 'MOVE_OUT_REJECTED',
      targetType: 'move_out',
      targetId: request._id,
      targetLabel: moLabel,
      details: request.rejectionReason || 'No reason given.',
    });
    await notify.notifyOwner(request.ownerId, {
      type: 'MOVE_OUT_REJECTED',
      message: `Move-out request for ${moLabel} was rejected.${request.rejectionReason ? ' Reason: ' + request.rejectionReason : ''}`,
      link: moSubject ? ownerPath(request.subjectType, moSubject._id) : undefined,
    });

    return success(res, 200, 'Move-out request rejected.', request);
  } catch (err) {
    next(err);
  }
}

// ======================= RESIDENCE HISTORY (spec §16) =======================

// GET /api/tenants/:id/history and /api/families/:id/history
function createHistoryHandler(subjectType) {
  return async function getHistory(req, res, next) {
    try {
      const Model = getSubjectModel(subjectType);
      const subject = await Model.findById(req.params.id);
      if (!subject) return error(res, 404, 'Record not found.');

      if (req.user.role === 'owner') {
        const owner = await requireOwnerProfile(req);
        if (subject.ownerId.toString() !== owner._id.toString()) {
          return error(res, 404, 'Record not found.');
        }
      }

      const history = await ResidenceHistory.find({ subjectType, subjectId: subject._id })
        .populate('houseId', 'houseId address village')
        .populate('roomId', 'roomId roomNumber')
        .populate('ownerId', 'ownerId name')
        .sort({ fromDate: 1 });

      return success(res, 200, 'Residence history fetched.', { history });
    } catch (err) {
      next(err);
    }
  };
}

const getTenantHistory = createHistoryHandler('tenant');
const getFamilyHistory = createHistoryHandler('family');

module.exports = {
  createTransferRequest,
  getTransferRequests,
  approveTransfer,
  rejectTransfer,
  createTenantMoveOutRequest,
  createFamilyMoveOutRequest,
  getMoveOutRequests,
  approveMoveOut,
  rejectMoveOut,
  getTenantHistory,
  getFamilyHistory,
};
