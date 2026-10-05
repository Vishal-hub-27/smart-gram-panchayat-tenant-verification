const Notification = require('../models/Notification');
const User = require('../models/User');
const Owner = require('../models/Owner');

// Spec §20: "Design notification functionality so email/SMS can be
// integrated later." Delivery is a list of channels; today there is one
// (in-app, a DB row). Adding email/SMS later means pushing another
// { name, send(userId, payload) } onto CHANNELS — no call site changes.
const inAppChannel = {
  name: 'in-app',
  async send(recipientId, { type, message, link }) {
    await Notification.create({ recipientId, type, message, link });
  },
};
const CHANNELS = [inAppChannel];

/**
 * Notifications are a side effect of an action that already succeeded
 * (an approval, a submission). A failure to notify must never make that
 * action look like it failed, so every path here catches and logs instead
 * of throwing.
 */
async function notifyUser(recipientId, payload) {
  if (!recipientId) return;
  for (const channel of CHANNELS) {
    try {
      await channel.send(recipientId, payload);
    } catch (err) {
      console.error(`[notify:${channel.name}] failed for ${recipientId}:`, err.message);
    }
  }
}

/** Notify an owner given their Owner PROFILE id (what records store). */
async function notifyOwner(ownerProfileId, payload) {
  try {
    const owner = await Owner.findById(ownerProfileId).select('userId');
    if (owner) await notifyUser(owner.userId, payload);
  } catch (err) {
    console.error('[notify] owner lookup failed:', err.message);
  }
}

/** Notify every active admin. */
async function notifyAdmins(payload) {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map((a) => notifyUser(a._id, payload)));
  } catch (err) {
    console.error('[notify] admin fan-out failed:', err.message);
  }
}

module.exports = { notifyUser, notifyOwner, notifyAdmins };
