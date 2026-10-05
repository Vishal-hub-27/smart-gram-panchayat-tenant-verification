const mongoose = require('mongoose');

// Owner profile. ownerId is assigned by idGeneratorService only once the
// owner's phone is verified (see authController.verifyOtp) — sparse+unique
// so multiple in-progress registrations don't collide on a null ownerId.
const ownerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      unique: true,
      sparse: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    village: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

ownerSchema.index({ village: 1 });

module.exports = mongoose.model('Owner', ownerSchema);
