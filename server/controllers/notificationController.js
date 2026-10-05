const Notification = require('../models/Notification');
const { success, error } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/paginate');

// A user only ever sees their own notifications: every query is scoped by
// recipientId = req.user._id, taken from the session, never the request.

// GET /api/notifications?unread=true
async function getNotifications(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { recipientId: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
    ]);

    return success(res, 200, 'Notifications fetched.', {
      notifications,
      unreadCount,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/unread-count  (cheap, polled by the navbar bell)
async function getUnreadCount(req, res, next) {
  try {
    const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, isRead: false });
    return success(res, 200, 'Unread count fetched.', { unreadCount });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return error(res, 404, 'Notification not found.');
    return success(res, 200, 'Marked as read.', n);
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return success(res, 200, 'All notifications marked as read.', { unreadCount: 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
