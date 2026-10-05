const Room = require('../models/Room');
const House = require('../models/House');

const { success, error } = require('../utils/response');
const { generateId } = require('../services/idGeneratorService');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { requireOwnerProfile } = require('./houseController');
const { isValidCapacityValue, canReduceCapacityTo } = require('../utils/roomRules');

/**
 * Loads a house by its public houseId and confirms it belongs to the
 * currently authenticated owner. Admins bypass the ownership check (they
 * can view any house's rooms) but only owners can create/edit rooms.
 */
async function requireOwnedHouse(req, houseId) {
  const house = await House.findOne({ houseId });
  if (!house) {
    const err = new Error('House not found.');
    err.statusCode = 404;
    throw err;
  }

  if (req.user.role === 'owner') {
    const owner = await requireOwnerProfile(req);
    if (house.ownerId.toString() !== owner._id.toString()) {
      const err = new Error('House not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  return house;
}

// ---------------------------------------------------------------------
// POST /api/rooms  (owner only)
// Body: { houseId, roomNumber, roomType, capacity }
// ---------------------------------------------------------------------
async function createRoom(req, res, next) {
  try {
    const { houseId, roomNumber, roomType, capacity } = req.body;
    const house = await requireOwnedHouse(req, houseId);

    const numericCapacity = Number(capacity);
    if (!isValidCapacityValue(numericCapacity)) {
      return error(res, 400, 'Room capacity must be a whole number of at least 1.');
    }

    const existing = await Room.findOne({ houseId: house._id, roomNumber });
    if (existing) {
      return error(res, 409, `Room "${roomNumber}" already exists for this house.`);
    }

    const roomId = await generateId('ROOM');

    const room = await Room.create({
      roomId,
      houseId: house._id,
      roomNumber,
      roomType,
      capacity: numericCapacity,
      // currentOccupancy intentionally not accepted from the client —
      // always starts at 0 for a newly created room (Rule 3).
    });

    return success(res, 201, 'Room added successfully.', room);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/rooms?houseId=H-2026-0001  (owner -> own house's rooms; admin -> any)
// ---------------------------------------------------------------------
async function getRooms(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.houseId) {
      const house = await requireOwnedHouse(req, req.query.houseId);
      filter.houseId = house._id;
    } else if (req.user.role === 'owner') {
      // No houseId given — list rooms across ALL of this owner's houses.
      const owner = await requireOwnerProfile(req);
      const houses = await House.find({ ownerId: owner._id }).select('_id');
      filter.houseId = { $in: houses.map((h) => h._id) };
    }
    // Admin with no houseId filter sees rooms across all houses.

    if (req.query.status) filter.status = req.query.status;

    const [rooms, total] = await Promise.all([
      Room.find(filter).sort({ roomNumber: 1 }).skip(skip).limit(limit),
      Room.countDocuments(filter),
    ]);

    return success(res, 200, 'Rooms fetched.', {
      rooms,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/rooms/:id
// ---------------------------------------------------------------------
async function getRoomById(req, res, next) {
  try {
    const room = await Room.findOne({ roomId: req.params.id });
    if (!room) {
      return error(res, 404, 'Room not found.');
    }

    if (req.user.role === 'owner') {
      const house = await House.findById(room.houseId);
      const owner = await requireOwnerProfile(req);
      if (!house || house.ownerId.toString() !== owner._id.toString()) {
        return error(res, 404, 'Room not found.');
      }
    }

    return success(res, 200, 'Room fetched.', room);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// PUT /api/rooms/:id  (owner, own room only)
// currentOccupancy can NEVER be set through this endpoint — it's managed
// exclusively by the tenant lifecycle (approval / transfer / move-out) in
// later phases. This is the enforcement point for Rule 3.
// ---------------------------------------------------------------------
async function updateRoom(req, res, next) {
  try {
    const room = await Room.findOne({ roomId: req.params.id });
    if (!room) {
      return error(res, 404, 'Room not found.');
    }

    const house = await House.findById(room.houseId);
    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      if (!house || house.ownerId.toString() !== owner._id.toString()) {
        return error(res, 404, 'Room not found.');
      }
    }

    const { roomNumber, roomType, capacity, status } = req.body;

    if (capacity !== undefined) {
      const numericCapacity = Number(capacity);
      if (!isValidCapacityValue(numericCapacity)) {
        return error(res, 400, 'Room capacity must be a whole number of at least 1.');
      }
      if (!canReduceCapacityTo(numericCapacity, room.currentOccupancy)) {
        return error(
          res,
          400,
          `Capacity cannot be reduced below the current occupancy (${room.currentOccupancy}).`
        );
      }
      room.capacity = numericCapacity;
    }

    if (roomNumber !== undefined) {
      const duplicate = await Room.findOne({
        houseId: room.houseId,
        roomNumber,
        _id: { $ne: room._id },
      });
      if (duplicate) {
        return error(res, 409, `Room "${roomNumber}" already exists for this house.`);
      }
      room.roomNumber = roomNumber;
    }

    if (roomType !== undefined) room.roomType = roomType;
    if (status !== undefined) room.status = status;

    await room.save();

    return success(res, 200, 'Room updated successfully.', room);
  } catch (err) {
    next(err);
  }
}

module.exports = { createRoom, getRooms, getRoomById, updateRoom };
