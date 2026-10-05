const AuditLog = require('../models/AuditLog');
const Admin = require('../models/Admin');

/**
 * Records a sensitive admin action (spec §21). Best-effort by design: it is
 * called AFTER the action has already been committed, so if the write fails
 * we log loudly rather than report a completed approval as an error. (A
 * stricter deployment could instead write the audit row first and abort the
 * action if it fails — a trade-off worth revisiting for production.)
 */
async function logAction({ actor, action, targetType, targetId, targetLabel, details }) {
  try {
    const admin = await Admin.findOne({ userId: actor._id }).select('adminId name');
    await AuditLog.create({
      actorUserId: actor._id,
      actorAdminId: admin?.adminId,
      actorName: admin?.name,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      targetLabel,
      details,
    });
  } catch (err) {
    console.error(`[audit] FAILED to record ${action}:`, err.message);
  }
}

module.exports = { logAction };
