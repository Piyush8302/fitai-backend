// Shared push-notification helper (Expo). Used by notifications + gym modules.
const Notification = require('../models/Notification');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://fitai-backend-icbh.onrender.com';

// Photo URL for a push thumbnail: a Cloudinary URL is used as-is; a legacy
// base64 avatar is served via /api/gym/avatar/:userId; no avatar → undefined.
const avatarImageUrl = (userId, avatar) => {
  const av = avatar ? String(avatar) : '';
  if (av.startsWith('http')) return av;
  if (av.startsWith('data:') && userId) return `${PUBLIC_BASE_URL}/api/gym/avatar/${userId}`;
  return undefined;
};

// Low-level: send raw Expo push messages to a list of tokens.
// `imageUrl` (optional) shows a big picture in the push (Android; iOS needs a
// Notification Service Extension in the native build to render it).
const sendExpoPush = async (pushTokens, title, body, data = {}, imageUrl) => {
  const messages = (pushTokens || [])
    .filter(t => t && t.startsWith('ExponentPushToken'))
    .map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
      ...(imageUrl ? { richContent: { image: imageUrl } } : {}),
    }));

  if (messages.length === 0) return;

  // Expo allows max ~100 per request, batch them
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
      const result = await res.json();
      console.log(`Expo push sent ${chunk.length}:`, JSON.stringify(result.data?.map(d => d.status) || result));
    } catch (e) {
      console.log('Expo push error:', e.message);
    }
  }
};

// High-level: persist an in-app Notification for each recipient AND push it.
// `recipients` = array of user docs/objects that have _id and (optionally) expoPushToken.
const notifyUsers = async (recipients, { title, body, type = 'info', data = {}, imageUrl } = {}) => {
  const list = (recipients || []).filter(Boolean);
  if (!list.length) return;
  // De-dupe by user id (owner could also be staff, etc.)
  const seen = new Set();
  const unique = list.filter(u => {
    const id = String(u._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  await Notification.insertMany(unique.map(u => ({ user: u._id, title, body, type, data })));
  // Expo caps a push message at ~4KB. A base64 photo (data URI) in `data` blows
  // past that and the push is silently dropped — so the in-app bell shows it but
  // no banner arrives. Strip heavy data-URI fields from the PUSH payload only
  // (the in-app record above keeps the full avatar). The photo still shows in the
  // push thumbnail via `imageUrl` (a small URL, not the base64).
  const pushData = { ...data };
  for (const k of Object.keys(pushData)) {
    if (typeof pushData[k] === 'string' && pushData[k].startsWith('data:')) delete pushData[k];
  }
  const tokens = unique.map(u => u.expoPushToken).filter(Boolean);
  if (tokens.length) {
    await sendExpoPush(tokens, title, body, pushData, imageUrl);
  }
  // Same notification to web browsers (owner PWA). No-op unless VAPID keys set.
  try {
    const { sendWebPushToUsers } = require('./webPush');
    await sendWebPushToUsers(unique.map(u => u._id), { title, body, data: pushData, image: imageUrl });
  } catch (e) {
    console.log('web push send error:', e.message);
  }
};

module.exports = { sendExpoPush, notifyUsers, avatarImageUrl };
