const mongoose = require('mongoose');

// Admin profile. Unlike owners, admins are NOT self-registered through the
// public API (see authController — there is no public admin registration
// endpoint). They're created by the seed script for development, or later
// by an existing admin through the "manage authorized admin users" feature
// (spec §3). This prevents anyone from signing up as a Gram Panchayat admin.
const adminSchema = new mongoose.Schema(
  {
    adminId: {
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
    designation: {
      type: String,
      trim: true,
      default: 'Gram Panchayat Officer',
    },
    permissions: {
      type: [String],
      default: [], // reserved for future fine-grained permission checks
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
