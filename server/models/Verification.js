const mongoose = require('mongoose');

// A Verification document is the admin-facing queue entry for a Tenant or
// Family application. It's deliberately separate from Tenant/Family's own
// `status` field — that field remains the single source of truth for the
// subject's own lifecycle, but querying "all applications awaiting review"
// would otherwise mean querying Tenant and Family separately and merging
// results by hand on every dashboard/queue request. This collection gives
// the admin queue one place to query across both subject types.
//
// Detailed status history stays on the Tenant/Family document itself
// (statusHistory, from Phase 4/5) — this model only tracks the queue's
// current state and review metadata, not a duplicate timeline.
const VERIFICATION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'RESUBMITTED', 'APPROVED', 'REJECTED'];

const verificationSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: ['tenant', 'family'],
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Points at either a Tenant or a Family document depending on
      // subjectType. Controllers resolve this manually rather than via
      // Mongoose's refPath, since it's only ever read in a couple of
      // places and a manual branch is simpler than adding a second
      // "subjectModel" field just to satisfy refPath.
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
    status: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'SUBMITTED',
    },
    // Line-item issues the admin flagged, most recent request last.
    // Kept as a flat array of strings (not history-of-arrays) since only
    // the current outstanding list matters for the owner to act on.
    correctionNotes: {
      type: [String],
      default: [],
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

verificationSchema.index({ status: 1 });
verificationSchema.index({ subjectType: 1, subjectId: 1 });
verificationSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Verification', verificationSchema);
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;
