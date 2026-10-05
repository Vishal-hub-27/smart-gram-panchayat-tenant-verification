const mongoose = require('mongoose');

// Base authentication identity, shared by both roles. Role-specific profile
// data (name, address, permissions, etc.) lives in the Owner/Admin models,
// referenced by userId — this keeps auth concerns (login, password, phone
// verification) separate from profile concerns.
const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never return this field unless explicitly requested
    },
    role: {
      type: String,
      enum: ['owner', 'admin'],
      required: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // OTP fields — hashed, never stored in plain text. Cleared after use.
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lastOtpSentAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
