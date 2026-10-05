const mongoose = require('mongoose');

// In-app notification (spec §20). recipientId is a User (not an Owner/Admin
// profile) so the same collection serves both roles and the auth layer's
// req.user._id is the only key needed to fetch "my notifications".
// `link` is a role-appropriate frontend path stored at creation time, so the
// client never has to work out where a notification should take you.
const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
