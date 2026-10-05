const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  isValidPhone,
  isValidOtp,
  isStrongPassword,
  isNonEmptyString,
} = require('../utils/validators');
const { config } = require('../config/env');

// Rate limit auth/OTP endpoints specifically — these are the most
// attractive targets for brute-forcing or SMS-bombing (spec §23).
const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMinutes * 60 * 1000,
  max: config.authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

router.post(
  '/register',
  authLimiter,
  validate({
    name: { check: isNonEmptyString, message: 'Please enter your name.' },
    phone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
    password: {
      check: isStrongPassword,
      message: 'Password must be at least 8 characters and include a letter and a number.',
    },
  }),
  authController.register
);

router.post(
  '/send-otp',
  authLimiter,
  validate({
    phone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
  }),
  authController.sendOtp
);

router.post(
  '/verify-otp',
  authLimiter,
  validate({
    phone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
    otp: { check: isValidOtp, message: 'Please enter the 6-digit OTP.' },
  }),
  authController.verifyOtp
);

router.post(
  '/login',
  authLimiter,
  validate({
    phone: { check: isValidPhone, message: 'Please enter a valid 10-digit phone number.' },
    password: { check: isNonEmptyString, message: 'Please enter your password.' },
  }),
  authController.login
);

router.get('/me', protect, authController.getMe);

module.exports = router;
