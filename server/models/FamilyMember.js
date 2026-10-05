const mongoose = require('mongoose');

// Family members are stored as individual records connected to the
// Family, per spec §8 ("Family members should be stored as individual
// records connected to the Family ID"). The head themselves is NOT
// duplicated here — head details live directly on the Family document
// (headName/headPhone) — this collection is only for additional members.
const familyMemberSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
    },
    name: { type: String, required: [true, "Member's name is required"], trim: true },
    relationship: {
      type: String,
      required: [true, 'Relationship to family head is required'],
      trim: true,
    },
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    photoUrl: { type: String, default: null },
  },
  { timestamps: true }
);

familyMemberSchema.index({ familyId: 1 });

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
