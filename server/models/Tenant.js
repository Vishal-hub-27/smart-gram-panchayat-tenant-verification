const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/statusEnums');

// Per spec §7 and §12: tenantId is NOT generated at submission time — only
// once the application passes admin approval (Phase 7). Until then the
// record is identified only by its Mongo _id, which the owner/admin APIs
// use internally; tenantId stays null/sparse-unique so many pending
// applications can coexist without an ID collision.
const STATUSES = APPLICATION_STATUSES;

const tenantSchema = new mongoose.Schema(
  {
    tenantId: {
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

    // ---- Personal details (spec §7) ----
    name: { type: String, required: [true, 'Tenant name is required'], trim: true },
    name: { type: String, required: [true, 'Tenant name is required'], trim: true },

phone: {
  type: String,
  required: [true, 'Tenant phone number is required'],
  trim: true,
},

isPhoneVerified: {
  type: Boolean,
  default: false,
},

phoneOtpHash: {
  type: String,
  select: false,
},

phoneOtpExpiresAt: {
  type: Date,
  select: false,
},

phoneOtpAttempts: {
  type: Number,
  default: 0,
  select: false,
},

lastPhoneOtpSentAt: {
  type: Date,
  select: false,
},

alternatePhone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    education: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },
    currentResidence: { type: String, trim: true },
    employer: { type: String, trim: true },

    photoUrl: { type: String, default: null },
    documents: [
      {
        label: { type: String, trim: true },
        url: { type: String, required: true },
      },
    ],

    // Populated at submission time if the owner proceeded past a duplicate
    // warning ("Continue Anyway" — see tenantController.createTenant).
    // Without this, that warning would be shown once and then lost — an
    // admin reviewing the application later (Phase 7) would have no way to
    // see it, even though spec §11 lists "Duplicate warnings" as something
    // the admin verification screen should show.
    duplicateFlags: [
      {
        recordType: { type: String, enum: ['tenant', 'family'] },
        matchedId: { type: String },
        name: { type: String },
        status: { type: String },
      },
    ],

    status: {
      type: String,
      enum: STATUSES,
      default: 'SUBMITTED',
    },
    // Every status change is recorded here (spec §10: "Every status change
    // should be recorded"). Admin correction reasons (Phase 7) will be
    // attached as the `note` on a CORRECTION_REQUIRED entry.
    statusHistory: [
      {
        status: { type: String, enum: STATUSES, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

tenantSchema.index({ ownerId: 1 });
tenantSchema.index({ houseId: 1 });
tenantSchema.index({ roomId: 1 });
tenantSchema.index({ phone: 1 });
tenantSchema.index({ status: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
module.exports.STATUSES = STATUSES;
