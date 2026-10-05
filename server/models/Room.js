const mongoose = require('mongoose');

// IMPORTANT (Rule 3, spec §6): currentOccupancy must never exceed capacity.
// currentOccupancy is intentionally NOT accepted from API request bodies
// anywhere (see roomController) — it is only ever changed by the system
// itself, when a tenant/family becomes ACTIVE in this room, transfers out,
// or moves out (Phases 7-9). Treating it as client-writable would let an
// owner silently corrupt the capacity invariant.
const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      unique: true,
      required: true,
    },
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number/name is required'],
      trim: true,
    },
    roomType: {
      type: String,
      enum: ['single', 'shared', 'family'],
      default: 'single',
    },
    capacity: {
      type: Number,
      required: [true, 'Room capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

roomSchema.index({ houseId: 1 });
// A room number should be unique within its house, not globally.
roomSchema.index({ houseId: 1, roomNumber: 1 }, { unique: true });

// Convenience virtual used by the frontend room cards (spec §6 example:
// "Available: 1").
roomSchema.virtual('available').get(function available() {
  return this.capacity - this.currentOccupancy;
});
roomSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Room', roomSchema);
