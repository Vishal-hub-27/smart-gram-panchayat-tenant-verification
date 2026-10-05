const { error } = require('../utils/response');

/**
 * Restricts a route to specific roles. Must be used AFTER authMiddleware.protect,
 * since it relies on req.user being already populated.
 *
 * Usage: router.get('/pending', protect, authorize('admin'), controller.fn)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 401, 'Not authorized. Please log in.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 403, 'You do not have permission to perform this action.');
    }

    next();
  };
}

module.exports = { authorize };
