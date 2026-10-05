const House = require('../models/House');
const Room = require('../models/Room');
const Owner = require('../models/Owner');

const { success, error } = require('../utils/response');
const { generateId } = require('../services/idGeneratorService');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { buildFileUrl } = require('../utils/fileUrl');

/**
 * Resolves the Owner profile for the currently authenticated user.
 * Centralized here so every handler enforces Rule 2 (owner cannot access
 * another owner's private records) the same way, by deriving ownerId from
 * the authenticated session rather than trusting anything in the request.
 */
async function requireOwnerProfile(req) {
  const owner = await Owner.findOne({ userId: req.user._id });
  if (!owner) {
    const err = new Error('Owner profile not found for this account.');
    err.statusCode = 404;
    throw err;
  }
  return owner;
}

// ---------------------------------------------------------------------
// POST /api/houses  (owner only)
// ---------------------------------------------------------------------
async function createHouse(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const { address, village, area, declaredRoomCount } = req.body;

    const houseId = await generateId('HOUSE');

    const house = await House.create({
      houseId,
      ownerId: owner._id,
      address,
      village,
      area,
      declaredRoomCount: declaredRoomCount ? Number(declaredRoomCount) : undefined,
      photoUrl: req.file ? buildFileUrl(req.file) : null,
    });

    return success(res, 201, 'House registered successfully.', house);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/houses  (owner -> own houses only; admin -> all, with filters)
// ---------------------------------------------------------------------
async function getHouses(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      filter.ownerId = owner._id;
    } else {
      // Admin can filter by village/status/owner across all houses.
      if (req.query.village) filter.village = new RegExp(req.query.village, 'i');
      if (req.query.status) filter.status = req.query.status;
      if (req.query.ownerId) filter.ownerId = req.query.ownerId;
    }

    const [houses, total] = await Promise.all([
      House.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      House.countDocuments(filter),
    ]);

    return success(res, 200, 'Houses fetched.', {
      houses,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/houses/:id
// ---------------------------------------------------------------------
async function getHouseById(req, res, next) {
  try {
    const house = await House.findOne({ houseId: req.params.id });
    if (!house) {
      return error(res, 404, 'House not found.');
    }

    if (req.user.role === 'owner') {
      const owner = await requireOwnerProfile(req);
      if (house.ownerId.toString() !== owner._id.toString()) {
        // Rule 2: never reveal another owner's house — a plain 404 here
        // avoids confirming to a probing user that the ID exists at all.
        return error(res, 404, 'House not found.');
      }
    }

    const rooms = await Room.find({ houseId: house._id }).sort({ roomNumber: 1 });

    return success(res, 200, 'House fetched.', { house, rooms });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// PUT /api/houses/:id  (owner, own house only)
// ---------------------------------------------------------------------
async function updateHouse(req, res, next) {
  try {
    const owner = await requireOwnerProfile(req);
    const house = await House.findOne({ houseId: req.params.id });

    if (!house) {
      return error(res, 404, 'House not found.');
    }
    if (house.ownerId.toString() !== owner._id.toString()) {
      return error(res, 404, 'House not found.');
    }

    // houseId and ownerId are never editable via this endpoint (Rule 7:
    // House ID must be unique/backend-generated; ownership must not be
    // reassignable by a client request).
    const { address, village, area, declaredRoomCount, status } = req.body;
    if (address !== undefined) house.address = address;
    if (village !== undefined) house.village = village;
    if (area !== undefined) house.area = area;
    if (declaredRoomCount !== undefined) house.declaredRoomCount = Number(declaredRoomCount);
    if (status !== undefined) house.status = status;

    if (req.file) {
      house.photoUrl = buildFileUrl(req.file);
    }

    await house.save();

    return success(res, 200, 'House updated successfully.', house);
  } catch (err) {
    next(err);
  }
}

module.exports = { createHouse, getHouses, getHouseById, updateHouse, requireOwnerProfile };
