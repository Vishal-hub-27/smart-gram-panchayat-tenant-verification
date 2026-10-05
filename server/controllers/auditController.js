const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');

// GET /api/audit-logs  (admin only) — read-only by design; there is
// deliberately no create/update/delete endpoint for this collection.
async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetType) filter.targetType = req.query.targetType;

    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) {
        const end = new Date(req.query.to);
        end.setHours(23, 59, 59, 999); // include the whole "to" day
        filter.timestamp.$lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return success(res, 200, 'Audit logs fetched.', { logs, pagination: buildPaginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs };
