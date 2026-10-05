const mongoose = require('mongoose');

// Not in the original model list, but necessary: spec §14 (Transfer)
// requires an owner-request-then-admin-approval two-step, and §15
// (Move-Out) describes the same shape ("... -> Admin Confirmation").
// One model handles both via requestType rather than two near-identical ones.
const residenceRequestSchema = new mongoose.Schema(
  {
    requestType: { type: String, enum: ['transfer', 'move_out'], required: true },
    subjectType: { type: String, enum: ['tenant', 'family'], required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    fromHouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'House', required: true },
    fromRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    toHouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'House' },
    toRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    moveOutDate: { type: Date },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

residenceRequestSchema.index({ requestType: 1, status: 1 });
residenceRequestSchema.index({ ownerId: 1 });
residenceRequestSchema.index({ subjectType: 1, subjectId: 1 });

module.exports = mongoose.model('ResidenceRequest', residenceRequestSchema);
