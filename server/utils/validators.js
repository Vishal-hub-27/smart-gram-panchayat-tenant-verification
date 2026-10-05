// Reusable validation functions. Kept framework-agnostic (no req/res here)
// so they can be unit tested directly and reused by validationMiddleware.

// Accepts Indian 10-digit mobile numbers, optionally with +91 prefix.
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const cleaned = phone.trim().replace(/^\+91/, '').replace(/\s+/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

// Normalizes a phone number to its bare 10-digit form for consistent
// storage/lookup regardless of how the user typed it.
function normalizePhone(phone) {
  return phone.trim().replace(/^\+91/, '').replace(/\s+/g, '');
}

function isStrongPassword(password) {
  if (typeof password !== 'string') return false;
  // At least 8 chars, one letter, one number — deliberately not overly
  // strict, since this is a village-facing app for non-technical users.
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

function isValidOtp(otp) {
  return typeof otp === 'string' && /^\d{6}$/.test(otp.trim());
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  isValidPhone,
  normalizePhone,
  isStrongPassword,
  isValidOtp,
  isNonEmptyString,
};
