const mongoose = require('mongoose');

// Append-only record of sensitive admin operations (spec §21, Rule 12).
// "Do not allow normal users to modify audit logs" is enforced in three
// layers: no update/delete API endpoints exist, the routes are admin-read-
// only, and — below — the schema itself refuses updates and deletes, so even
// a future coding mistake can't quietly rewrite history through Mongoose.
const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorAdminId: { type: String }, // e.g. "A-2026-0001" — matches spec's "Admin: A1001" example
    actorName: { type: String },
    action: { type: String, required: true }, // e.g. APPROVED_TENANT
    targetType: { type: String, required: true }, // tenant | family | transfer | move_out
    targetId: { type: String }, // business ID where one exists (T-2026-0001), else Mongo id
    targetLabel: { type: String }, // human-readable, e.g. the tenant's name
    details: { type: String },
    timestamp: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetType: 1 });

const BLOCKED = [
  'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace',
  'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete',
];
BLOCKED.forEach((op) => {
  auditLogSchema.pre(op, function blockMutation() {
    throw new Error('Audit logs are append-only and cannot be modified or deleted.');
  });
});
// Re-saving an existing document counts as an update too.
auditLogSchema.pre('save', function blockResave() {
  if (!this.isNew) throw new Error('Audit logs are append-only and cannot be modified.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
