const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/statusEnums');

const familySchema = new mongoose.Schema(
  {
    // Same deferred-ID pattern as Tenant (spec §7/§12/§8: "Generate Family ID"
    // happens only after admin verification, not at creation.
    familyId: {
      type: String,
      unique: true,
      sparse: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Owner',
      required: true,
    },
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },

    // ---- Family head (spec §8 example structure) ----
    headName: { type: String, required: [true, 'Family head name is required'], trim: true },
    headPhone: { type: String, required: [true, 'Family head phone number is required'], trim: true },
    alternatePhone: { type: String, trim: true },
    headPhotoUrl: { type: String, default: null },
    documents: [
      {
        label: { type: String, trim: true },
        url: { type: String, required: true },
      },
    ],

    // Same purpose as Tenant.duplicateFlags — see that model's comment.
    duplicateFlags: [
      {
        recordType: { type: String, enum: ['tenant', 'family'] },
        matchedId: { type: String },
        name: { type: String },
        status: { type: String },
      },
    ],

    // Permanently flips to true the first time the head's phone is
    // confirmed via OTP (during an existing-family claim — spec §8). New
    // families created directly are not required to verify at creation;
    // admin verification (Phase 7) covers that case instead.
    isHeadPhoneVerified: { type: Boolean, default: false },

    // ---- OTP fields for the "claim an existing family" flow ----
    // Distinct from User's OTP fields since a family head is not
    // necessarily a User account in this system — the owner is acting on
    // the family's behalf, and this OTP proves the phone they're claiming
    // actually belongs to the family already on record.
    headOtpHash: { type: String, select: false },
    headOtpExpiresAt: { type: Date, select: false },
    headOtpAttempts: { type: Number, default: 0, select: false },
    // Short-lived proof of a successful OTP verification. The
    // update-residence endpoint requires this to be within the last few
    // minutes, then consumes (clears) it — a single OTP verification
    // authorizes exactly one residence update.
    headOtpVerifiedAt: { type: Date, select: false },

    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'SUBMITTED',
    },
    statusHistory: [
      {
        status: { type: String, enum: APPLICATION_STATUSES, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

familySchema.index({ ownerId: 1 });
familySchema.index({ houseId: 1 });
familySchema.index({ headPhone: 1 });
familySchema.index({ status: 1 });

module.exports = mongoose.model('Family', familySchema);
