// Pure functions implementing Rule 3 ("Never allow the number of active
// occupants to exceed room capacity") and related capacity checks.
// Kept dependency-free so they can be unit tested without a database.

function isValidCapacityValue(capacity) {
  const n = Number(capacity);
  return Number.isInteger(n) && n >= 1;
}

/**
 * Returns true if capacity can safely be reduced to `newCapacity` given
 * how many people are currently occupying the room.
 */
function canReduceCapacityTo(newCapacity, currentOccupancy) {
  return Number(newCapacity) >= Number(currentOccupancy);
}

/**
 * Returns true if one more occupant can be added to a room without
 * breaching capacity. Used in later phases when a tenant/family is
 * approved into a room.
 */
function hasAvailableSpace(capacity, currentOccupancy, additionalOccupants = 1) {
  return Number(currentOccupancy) + Number(additionalOccupants) <= Number(capacity);
}

module.exports = { isValidCapacityValue, canReduceCapacityTo, hasAvailableSpace };
