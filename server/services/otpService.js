const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { config } = require('../config/env');

/**
 * Generates a random 6-digit OTP code.
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hashes an OTP before storing it — OTPs are short-lived secrets and should
 * never sit in the database in plain text, same principle as passwords.
 */
async function hashOtp(otp) {
  return bcrypt.hash(otp, config.bcryptSaltRounds);
}

async function compareOtp(otp, otpHash) {
  if (!otpHash) return false;
  return bcrypt.compare(otp, otpHash);
}

/**
 * "Sends" an OTP to a phone number. In mock mode (default for dev), this
 * just logs to the console instead of calling a real SMS provider — but the
 * function signature and return shape are exactly what a real provider
 * integration (Twilio, MSG91, etc.) would need, so swapping in a real
 * provider later only means changing the inside of this function.
 */
async function sendOtp(phone, otp) {
  if (config.otpMockMode) {
    console.log(`[MOCK SMS] OTP for ${phone}: ${otp} (expires in ${config.otpExpiryMinutes} min)`);
    return { delivered: true, provider: 'mock' };
  }

  // Real provider integration point — e.g.:
  // const result = await smsProviderClient.send({ to: phone, message: `Your OTP is ${otp}` });
  // return { delivered: true, provider: 'twilio', providerId: result.sid };
  throw new Error('No live SMS provider configured. Set OTP_MOCK_MODE=true for development.');
}

module.exports = { generateOtp, hashOtp, compareOtp, sendOtp };
