const { config } = require('../config/env');

// 404 handler for unmatched routes — must be registered after all routes.
function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

// Central error handler — must be registered LAST in app.js (4 args = Express
// recognizes this as an error middleware).
// Per spec section 29: never show raw backend errors to end users.
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong. Please try again.';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier supplied.';
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Please check the submitted information and try again.';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with this information already exists.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired or invalid. Please log in again.';
  }

  // Log full detail server-side always; never send stack traces to the client.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ->`, err);

  res.status(statusCode).json({
    success: false,
    message,
    // Stack only ever included in non-production for local debugging.
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
