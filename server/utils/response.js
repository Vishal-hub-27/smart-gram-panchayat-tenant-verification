// Standardized response helpers so every endpoint returns the same shape.
// Frontend can rely on { success, message, data } / { success, message, errors }
// without guessing the structure per-route.

function success(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function error(res, statusCode, message, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

module.exports = { success, error };
