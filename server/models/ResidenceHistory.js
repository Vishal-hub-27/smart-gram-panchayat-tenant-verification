const mongoose = require('mongoose');

// The permanent, append-only residence timeline (spec §16). Each document
// is one continuous period of residence. A period with toDate=null is the
// subject's CURRENT residence — only ever one open period per subject
// (Rule 4), enforced by always closing the current period before opening
// a new one. Rule 8: entries are never deleted or edited once closed.
const residenceHistorySchema = new mongoose.Schema(
  {
    subjectType: { type: String, enum: ['tenant', 'family'], required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    houseId: { type: mongoose.Schema.Types.ObjectId, ref: 'House', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    fromDate: { type: Date, required: true, default: Date.now },
    toDate: { type: Date, default: null },
    endReason: { type: String, enum: ['transfer', 'move_out', null], default: null },
  },
  { timestamps: true }
);

residenceHistorySchema.index({ subjectType: 1, subjectId: 1, fromDate: 1 });
residenceHistorySchema.index({ subjectType: 1, subjectId: 1, toDate: 1 });

module.exports = mongoose.model('ResidenceHistory', residenceHistorySchema);
