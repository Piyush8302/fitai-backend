// Shared push-notification helper (Expo). Used by notifications + gym modules.
const Notification = require('../models/Notification');

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
  const tokens = unique.map(u => u.expoPushToken).filter(Boolean);
  if (tokens.length) await sendExpoPush(tokens, title, body, data, imageUrl);
};

module.exports = { sendExpoPush, notifyUsers };
