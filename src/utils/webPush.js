// Web Push (VAPID) — delivers the same notifications to the owner PWA
// (fitai-owner-web) that Expo push delivers to the mobile app. iOS Safari
// only receives these inside an installed PWA (Add to Home Screen, iOS 16.4+).
// Enabled when WEB_PUSH_PUBLIC_KEY + WEB_PUSH_PRIVATE_KEY are set on Render;
// otherwise every function is a silent no-op (nothing else breaks).
const webpush = require('web-push');

const PUBLIC_KEY = process.env.WEB_PUSH_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.WEB_PUSH_PRIVATE_KEY || '';

let configured = false;
const ready = () => {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(
      `mailto:${process.env.EMAIL_USER || 'yadavpiyush8302@gmail.com'}`,
      PUBLIC_KEY,
      PRIVATE_KEY
    );
    configured = true;
  }
  return true;
};

const getPublicKey = () => (PUBLIC_KEY ? PUBLIC_KEY : null);

// Send { title, body, data, image } to every web subscription of the given
// user ids. Dead subscriptions (404/410 — browser unsubscribed) are pruned.
const sendWebPushToUsers = async (userIds, payload) => {
  if (!ready() || !userIds || !userIds.length) return;
  const User = require('../models/User');
  const users = await User.find({
    _id: { $in: userIds },
    'webPushSubscriptions.0': { $exists: true },
  }).select('webPushSubscriptions');
  if (!users.length) return;

  const body = JSON.stringify(payload);
  for (const u of users) {
    const dead = [];
    await Promise.all(
      (u.webPushSubscriptions || []).map(async (sub) => {
        try {
          await webpush.sendNotification(sub, body);
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint);
          else console.log('web push error:', e.statusCode || e.message);
        }
      })
    );
    if (dead.length) {
      await User.updateOne(
        { _id: u._id },
        { $pull: { webPushSubscriptions: { endpoint: { $in: dead } } } }
      );
    }
  }
};

module.exports = { getPublicKey, sendWebPushToUsers };
