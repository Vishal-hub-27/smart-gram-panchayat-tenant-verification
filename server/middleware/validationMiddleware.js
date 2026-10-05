const { error } = require('../utils/response');

/**
 * Generic validation middleware factory. Pass a rules object mapping field
 * names to a validator function + friendly error message. Keeps controllers
 * free of repetitive "if (!isValidPhone(...))" boilerplate.
 *
 * Example:
 *   validate({
 *     phone: { check: isValidPhone, message: 'Please enter a valid phone number.' },
 *     password: { check: isStrongPassword, message: 'Password must be at least 8 characters with a letter and a number.' },
 *   })
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];
      if (!rule.check(value)) {
        errors.push({ field, message: rule.message });
      }
    }

    if (errors.length > 0) {
      // Show the first error as the headline message (per spec §29:
      // friendly, specific validation messages), full list in `errors`
      // for the frontend to highlight individual fields if it wants to.
      return error(res, 400, errors[0].message, errors);
    }

    next();
  };
}

module.exports = { validate };
