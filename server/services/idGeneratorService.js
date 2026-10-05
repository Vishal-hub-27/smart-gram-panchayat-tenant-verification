const Counter = require('../models/Counter');
const { formatId } = require('../utils/generateId');

/**
 * Atomically generates the next unique ID for a given entity type, scoped
 * to the current calendar year (e.g. O-2026-0001, O-2026-0002, ...).
 *
 * Uses findOneAndUpdate with $inc + upsert, which MongoDB guarantees is
 * atomic — so two simultaneous requests can never receive the same number,
 * satisfying Rule 6/7/12 (unique IDs, backend-generated, never reused).
 *
 * @param {'OWNER'|'ADMIN'|'HOUSE'|'ROOM'|'TENANT'|'FAMILY'} entityType
 * @returns {Promise<string>} formatted ID, e.g. "O-2026-0001"
 */
async function generateId(entityType) {
  const year = new Date().getFullYear();
  const counterKey = `${entityType}-${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return formatId(entityType, year, counter.seq);
}

module.exports = { generateId };
