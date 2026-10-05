const { success, error } = require('../utils/response');
const { findPossibleDuplicates } = require('../services/duplicateCheckService');
const { normalizePhone } = require('../utils/validators');

// GET /api/tenants/duplicate-check?phone=...
// GET /api/families/duplicate-check?phone=...
// Both mount this same handler — the underlying service already searches
// across Tenant and Family records together (see duplicateCheckService),
// so a single shared endpoint implementation keeps the two consistent.
async function checkDuplicate(req, res, next) {
  try {
    const { phone } = req.query;
    if (!phone) {
      return error(res, 400, 'Phone number is required to check for duplicates.');
    }
    const matches = await findPossibleDuplicates(normalizePhone(phone));
    return success(
      res,
      200,
      matches.length > 0 ? 'Possible existing records found.' : 'No matching records found.',
      { possibleDuplicate: matches.length > 0, matches }
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { checkDuplicate };
