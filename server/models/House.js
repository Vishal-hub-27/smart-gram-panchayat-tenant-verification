const mongoose = require('mongoose');

// Unlike Tenant/Family, a House does not go through admin verification —
// only the tenants living in it do (per spec §11). So houseId is assigned
// immediately on creation, not deferred to an approval step.
const houseSchema = new mongoose.Schema(
  {
    houseId: {
      type: String,
      unique: true,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Owner',
      required: true,
    },
    address: {
      type: String,
      required: [true, 'House address is required'],
      trim: true,
    },
    village: {
      type: String,
      required: [true, 'Village is required'],
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    // Owner's declared room count at registration time — informational
    // only. The authoritative source of truth for how many rooms actually
    // exist is the Room collection (see roomController); this field is not
    // used for capacity enforcement anywhere.
    declaredRoomCount: {
      type: Number,
      min: 0,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

houseSchema.index({ ownerId: 1 });
houseSchema.index({ village: 1 });

module.exports = mongoose.model('House', houseSchema);
