const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Owner = require('../models/Owner');
const Admin = require('../models/Admin');

const { config } = require('../config/env');
const { success, error } = require('../utils/response');
const { normalizePhone } = require('../utils/validators');
const { generateId } = require('../services/idGeneratorService');
const otpService = require('../services/otpService');

const OTP_RESEND_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = 5;

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Builds the safe user payload sent to the client — never includes
 * passwordHash, otpHash, or other internal fields.
 */
async function buildAuthResponse(user) {
  let profile = null;

  if (user.role === 'owner') {
    profile = await Owner.findOne({ userId: user._id });
  } else if (user.role === 'admin') {
    profile = await Admin.findOne({ userId: user._id });
  }

  return {
    token: signToken(user),
    user: {
      id: user._id,
      phone: user.phone,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
    },
    profile,
  };
}

// ---------------------------------------------------------------------
// POST /api/auth/register
// Owner self-registration. Creates an unverified User + Owner profile
// (no ownerId yet) and immediately sends an OTP to confirm the phone
// number, per spec §4: Register -> Mobile Number -> OTP -> Create Account.
// ---------------------------------------------------------------------
async function register(req, res, next) {
  try {
    const { name, phone, password, address, village } = req.body;
    const cleanPhone = normalizePhone(phone);

    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) {
      if (existing.isPhoneVerified) {
        return error(res, 409, 'An account with this phone number already exists. Please log in instead.');
      }
      // Unverified account already exists (abandoned registration) —
      // let them continue from where they left off rather than blocking.
      return error(res, 409, 'This phone number is already registered but not verified. Please request a new OTP.');
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
    const otp = otpService.generateOtp();
    const otpHash = await otpService.hashOtp(otp);

    const user = await User.create({
      phone: cleanPhone,
      passwordHash,
      role: 'owner',
      isPhoneVerified: false,
      otpHash,
      otpExpiresAt: new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000),
      lastOtpSentAt: new Date(),
    });

    await Owner.create({
      userId: user._id,
      name,
      address,
      village,
      // ownerId intentionally omitted — assigned on successful OTP verification
    });

    await otpService.sendOtp(cleanPhone, otp);

    const responsePayload = { phone: cleanPhone };
    // Dev convenience only: never expose OTP in production responses.
    if (!config.isProduction) {
      responsePayload.devOtp = otp;
    }

    return success(res, 201, 'Registration started. Please verify the OTP sent to your phone.', responsePayload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/send-otp
// Resends an OTP for an existing, not-yet-verified account (or for future
// login-via-OTP flows). Rate-limited both by express-rate-limit on the
// route and a cooldown check here.
// ---------------------------------------------------------------------
async function sendOtp(req, res, next) {
  try {
    const { phone } = req.body;
    const cleanPhone = normalizePhone(phone);

    const user = await User.findOne({ phone: cleanPhone }).select('+lastOtpSentAt');
    if (!user) {
      return error(res, 404, 'No account found with this phone number.');
    }

    if (user.isPhoneVerified) {
      return error(res, 400, 'This phone number is already verified. Please log in.');
    }

    if (user.lastOtpSentAt) {
      const secondsSinceLast = (Date.now() - user.lastOtpSentAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast);
        return error(res, 429, `Please wait ${wait} seconds before requesting another OTP.`);
      }
    }

    const otp = otpService.generateOtp();
    user.otpHash = await otpService.hashOtp(otp);
    user.otpExpiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);
    user.otpAttempts = 0;
    user.lastOtpSentAt = new Date();
    await user.save();

    await otpService.sendOtp(cleanPhone, otp);

    const responsePayload = { phone: cleanPhone };
    if (!config.isProduction) {
      responsePayload.devOtp = otp;
    }

    return success(res, 200, 'A new OTP has been sent to your phone.', responsePayload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/verify-otp
// Confirms the OTP, activates the account, assigns the Owner ID (only now
// — per spec §12, IDs are backend-generated at the right lifecycle point),
// and logs the user in immediately.
// ---------------------------------------------------------------------
async function verifyOtp(req, res, next) {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = normalizePhone(phone);

    const user = await User.findOne({ phone: cleanPhone }).select('+otpHash +otpExpiresAt +otpAttempts');
    if (!user) {
      return error(res, 404, 'No account found with this phone number.');
    }

    if (user.isPhoneVerified) {
      return error(res, 400, 'This phone number is already verified. Please log in.');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return error(res, 400, 'This OTP has expired. Please request a new one.');
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return error(res, 429, 'Too many incorrect attempts. Please request a new OTP.');
    }

    const isMatch = await otpService.compareOtp(otp, user.otpHash);
    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      return error(res, 400, 'Incorrect OTP. Please try again.');
    }

    user.isPhoneVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Assign the permanent Owner ID now that the account is confirmed real.
    if (user.role === 'owner') {
      const ownerId = await generateId('OWNER');
      await Owner.findOneAndUpdate({ userId: user._id }, { ownerId });
    }

    const payload = await buildAuthResponse(user);
    return success(res, 200, 'Phone verified successfully. You are now logged in.', payload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------
async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const cleanPhone = normalizePhone(phone);

    const user = await User.findOne({ phone: cleanPhone }).select('+passwordHash');
    if (!user) {
      // Deliberately generic message — don't reveal whether the phone
      // number exists in the system.
      return error(res, 401, 'Invalid phone number or password.');
    }

    if (!user.isActive) {
      return error(res, 403, 'This account has been deactivated. Contact the Gram Panchayat admin.');
    }

    if (!user.isPhoneVerified) {
      return error(res, 403, 'Please verify your phone number before logging in.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return error(res, 401, 'Invalid phone number or password.');
    }

    const payload = await buildAuthResponse(user);
    return success(res, 200, 'Login successful.', payload);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------
async function getMe(req, res, next) {
  try {
    const payload = await buildAuthResponse(req.user);
    // No need to re-issue a token here, but reusing buildAuthResponse
    // keeps the profile-fetching logic in one place.
    delete payload.token;
    return success(res, 200, 'Current user fetched.', payload);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, sendOtp, verifyOtp, login, getMe };
