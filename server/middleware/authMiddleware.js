const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const User = require('../models/User');
const { error } = require('../utils/response');

/**
 * Verifies the JWT from the Authorization header and attaches the
 * corresponding User document to req.user. Re-checks isActive on every
 * request so a deactivated account is locked out immediately, not just
 * until its existing token expires.
 */
async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 401, 'Not authorized. Please log in.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.id);

    if (!user) {
      return error(res, 401, 'Account no longer exists. Please log in again.');
    }

    if (!user.isActive) {
      return error(res, 403, 'This account has been deactivated. Contact the Gram Panchayat admin.');
    }

    req.user = user;
    next();
  } catch (err) {
    // JWT errors (expired/invalid) are normalized by errorMiddleware,
    // but we handle them here directly so we can respond with the
    // exact 401 the frontend's axios interceptor expects.
    return error(res, 401, 'Session expired or invalid. Please log in again.');
  }
}

module.exports = { protect };
