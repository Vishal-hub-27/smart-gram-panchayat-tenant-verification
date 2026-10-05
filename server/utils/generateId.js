// Pure formatting helpers — no DB access here, so they're trivial to unit
// test in isolation. All the "generate a unique number" logic lives in
// services/idGeneratorService.js; this file only formats a given number.

const PREFIXES = {
  OWNER: 'O',
  ADMIN: 'A',
  HOUSE: 'H',
  ROOM: 'R',
  TENANT: 'T',
  FAMILY: 'F',
};

/**
 * Pads a sequence number to a fixed width, e.g. pad(7, 4) -> "0007".
 */
function pad(num, width = 4) {
  return String(num).padStart(width, '0');
}

/**
 * Formats an entity ID like "O-2026-0001" from its parts.
 * @param {string} entityType - one of PREFIXES keys (e.g. 'OWNER')
 * @param {number} year
 * @param {number} seq
 */
function formatId(entityType, year, seq) {
  const prefix = PREFIXES[entityType];
  if (!prefix) {
    throw new Error(`Unknown entity type for ID generation: ${entityType}`);
  }
  return `${prefix}-${year}-${pad(seq, 4)}`;
}

module.exports = { pad, formatId, PREFIXES };
