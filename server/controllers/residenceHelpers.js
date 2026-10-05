const House = require('../models/House');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Family = require('../models/Family');
const FamilyMember = require('../models/FamilyMember');

/** Resolves the Tenant or Family model for a subjectType. */
function getSubjectModel(subjectType) {
  return subjectType === 'tenant' ? Tenant : Family;
}

/**
 * Room slots a subject occupies: 1 for a single tenant, or head + member
 * count for a family. Used everywhere capacity is checked or adjusted
 * (approval, transfer, move-out).
 */
async function getOccupantCount(subjectType, subject) {
  if (subjectType === 'tenant') return 1;
  const memberCount = await FamilyMember.countDocuments({ familyId: subject._id });
  return 1 + memberCount;
}

/**
 * Loads a house + room pair and confirms both belong to the given owner,
 * and that the room actually belongs to the house.
 */
async function requireOwnedHouseAndRoom(ownerId, houseId, roomId) {
  const house = await House.findOne({ houseId, ownerId });
  if (!house) {
    const err = new Error('Selected house was not found.');
    err.statusCode = 404;
    throw err;
  }

  const room = await Room.findOne({ roomId, houseId: house._id });
  if (!room) {
    const err = new Error('Selected room was not found for this house.');
    err.statusCode = 404;
    throw err;
  }

  return { house, room };
}

module.exports = { requireOwnedHouseAndRoom, getSubjectModel, getOccupantCount };
