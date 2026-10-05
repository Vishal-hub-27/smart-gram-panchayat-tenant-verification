const mongoose = require('mongoose');

// Not part of the original spec's model list, but required to satisfy
// Rule 6/7/12 ("IDs must be unique and never reused", "Do not depend on
// frontend-generated IDs") safely under concurrent requests.
//
// Two owners submitting applications at the same instant must never receive
// the same Owner/House/Tenant/Family ID. A naive "count documents + 1"
// approach has a race condition. This Counter collection + atomic
// findOneAndUpdate($inc) in idGeneratorService guarantees each call gets a
// strictly unique, sequential number even under concurrent load.
//
// _id is the counter key, e.g. "OWNER-2026", "HOUSE-2026", "TENANT-2026"
// (scoped per entity type per year, matching the O-2026-0001 ID format).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
