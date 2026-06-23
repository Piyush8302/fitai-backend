const Notification = require('../models/Notification');
const User = require('../models/User');

const sendExpoPush = async (pushTokens, title, body, data = {}) => {
  const messages = pushTokens
    .filter(t => t && t.startsWith('ExponentPushToken'))
    .map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    }));

  if (messages.length === 0) return;

  // Expo allows max ~100 per request, batch them
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

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
      console.log(`Expo push sent ${chunk.length} notifications:`, JSON.stringify(result.data?.map(d => d.status) || result));
    } catch (e) {
      console.log('Expo push error:', e.message);
    }
  }
};

// ===== DAILY CALORIE TARGET CHECK (runs via server.js scheduler at ~9 PM IST) =====
// Compares each user's caloriesConsumed vs goal-adjusted target and pushes
// a goal-aware notification: over/under/on-target.
exports.runDailyCalorieCheck = async () => {
  try {
    const Tracking = require('../models/Tracking');
    const { getGoalAdjustedCalories } = require('../utils/calorieGoal');

    // Today in IST (same format as tracking controller)
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = ist.toISOString().split('T')[0];

    const users = await User.find({
      isActive: true,
      expoPushToken: { $exists: true, $ne: null },
      dailyCalories: { $exists: true, $ne: null },
    }).select('_id name expoPushToken bmr dailyCalories fitnessGoal');

    let sent = 0;
    for (const user of users) {
      try {
        const tracking = await Tracking.findOne({ user: user._id, date: today }).select('caloriesConsumed');
        const consumed = tracking?.caloriesConsumed || 0;
        if (consumed <= 0) continue; // nothing logged today — skip (no spam)

        const target = getGoalAdjustedCalories(user);
        const diff = consumed - target;
        const isGain = ['weight_gain', 'muscle_building'].includes(user.fitnessGoal);
        const firstName = (user.name || '').split(' ')[0] || 'there';

        let title, body, type;
        if (diff > 150) {
          if (isGain) {
            title = '💪 Surplus Achieved!';
            body = `Great job ${firstName}! You ate ${consumed} kcal — ${diff} above your ${target} kcal target. Perfect for gaining!`;
            type = 'success';
          } else {
            title = '⚠️ Calorie Target Crossed';
            body = `${firstName}, you ate ${consumed} kcal today — ${diff} over your ${target} kcal target. A 20-min walk can help balance it!`;
            type = 'warning';
          }
        } else if (diff < -300) {
          if (isGain) {
            title = '🍽 Eat More to Grow!';
            body = `${firstName}, you're ${Math.abs(diff)} kcal under your ${target} kcal target. Add a banana shake or paneer to hit your gain goal!`;
            type = 'reminder';
          } else {
            title = '🥗 Eating Too Little?';
            body = `${firstName}, only ${consumed} kcal today vs ${target} target. Eating too little slows metabolism — aim closer to target!`;
            type = 'alert';
          }
        } else {
          title = '🎯 Target Hit!';
          body = `Perfect ${firstName}! ${consumed} kcal vs ${target} target — right on track. Keep it up! 🔥`;
          type = 'success';
        }

        await Notification.create({ user: user._id, title, body, type, data: { screen: 'Tracking' } });
        await sendExpoPush([user.expoPushToken], title, body, { screen: 'Tracking' });
        sent++;
      } catch (e) { /* skip user on error */ }
    }
    console.log(`[DailyCalorieCheck] ${today}: notified ${sent}/${users.length} users`);
    return sent;
  } catch (e) {
    console.log('[DailyCalorieCheck] error:', e.message);
  }
};

// ===== GYM FEE REMINDERS (runs twice daily via scheduler) =====
// Reminds members whose fee is due within 3 days OR overdue, until they pay.
// When the owner marks payment, dueDate jumps forward → reminders auto-stop.
// IMPORTANT: gym name is in the title so the user knows it's a GYM notification,
// not a FitAI fitness notification.
exports.runGymFeeReminders = async () => {
  try {
    const Membership = require('../models/Membership');
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    // 60-day overdue cap so we don't spam forever on dead memberships
    const overdueCap = new Date(now.getTime() - 60 * 24 * 3600 * 1000);

    const memberships = await Membership.find({
      fee: { $gt: 0 },
      plan: { $nin: ['trial', 'day_pass'] },
      status: 'active',
      dueDate: { $lte: threeDays, $gte: overdueCap },
    }).populate('gym', 'name').populate('user', 'name expoPushToken');

    let sent = 0;
    for (const m of memberships) {
      const u = m.user;
      if (!u?.expoPushToken) continue;
      const gymName = m.gym?.name || 'Your gym';
      const due = new Date(m.dueDate);
      const overdue = due < now;
      const firstName = (u.name || '').split(' ')[0] || 'there';

      // Gym name in title → clearly a gym notification (not FitAI)
      const title = `🏋️ ${gymName}`;
      const body = overdue
        ? `Hi ${firstName}! Your ${gymName} fee is pending 🙏 Pay at the counter & keep crushing your goals 💪`
        : `Hi ${firstName}! Gentle reminder — your ${gymName} fee is due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Stay consistent, pay on time 🔥`;

      await Notification.create({ user: u._id, title, body, type: 'reminder', data: { screen: 'MyGymCard', gym: gymName, kind: 'gym_fee' } });
      await sendExpoPush([u.expoPushToken], title, body, { screen: 'MyGymCard' });
      sent++;
    }
    console.log(`[GymFeeReminder] sent ${sent} reminders`);
    return sent;
  } catch (e) {
    console.log('[GymFeeReminder] error:', e.message);
  }
};

// @desc    Get user notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { user: req.user.id };
    if (unreadOnly === 'true') filter.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user.id, isRead: false }),
    ]);

    res.json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      pages: Math.ceil(total / parseInt(limit)),
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a notification
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user: req.user.id, isRead: false });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    next(error);
  }
};

// @desc    Save push token
exports.savePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ success: false, message: 'Provide pushToken' });

    await User.findByIdAndUpdate(req.user.id, { expoPushToken: pushToken });
    res.json({ success: true, message: 'Push token saved' });
  } catch (error) {
    next(error);
  }
};

// @desc    Send notification (admin - by userId/email/phone or broadcast to all)
exports.sendNotification = async (req, res, next) => {
  try {
    const { userId, email, phone, title, body, message, type, data, targetAudience } = req.body;
    const notifBody = body || message;
    if (!title || !notifBody) {
      return res.status(400).json({ success: false, message: 'Provide title and body/message' });
    }

    const notifType = type || 'info';

    if (targetAudience === 'all') {
      const users = await User.find({ isActive: { $ne: false } }).select('_id expoPushToken');
      const notifications = users.map(u => ({ user: u._id, title, body: notifBody, type: notifType }));
      await Notification.insertMany(notifications);

      const pushTokens = users.map(u => u.expoPushToken).filter(Boolean);
      if (pushTokens.length > 0) await sendExpoPush(pushTokens, title, notifBody, data);

      return res.status(201).json({ success: true, message: `Sent to ${users.length} users (${pushTokens.length} push)` });
    }

    let targetUser;
    if (userId) {
      targetUser = await User.findById(userId).select('_id expoPushToken');
    } else if (email) {
      targetUser = await User.findOne({ email }).select('_id expoPushToken');
    } else if (phone) {
      targetUser = await User.findOne({ phone }).select('_id expoPushToken');
    } else {
      return res.status(400).json({ success: false, message: 'Provide userId, email, phone, or set targetAudience to "all"' });
    }

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    const notification = await Notification.create({ user: targetUser._id, title, body: notifBody, type: notifType, data });
    if (targetUser.expoPushToken) await sendExpoPush([targetUser.expoPushToken], title, notifBody, data);

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

// @desc    Send daily health tip (cron/admin triggered)
exports.sendDailyTip = async (req, res, next) => {
  try {
    const tips = [
      { title: '💧 Stay Hydrated!', body: 'Drink at least 8 glasses of water today. Your body is 60% water!' },
      { title: '🥗 Eat Your Greens', body: 'Include at least 2 servings of vegetables in your meals today.' },
      { title: '🏃 Move More', body: 'Take a 10-minute walk after lunch. It helps digestion and burns calories.' },
      { title: '😴 Sleep Well', body: 'Aim for 7-8 hours of sleep tonight. Sleep is crucial for muscle recovery.' },
      { title: '🧘 Stress Less', body: 'Try 5 minutes of deep breathing today. Stress increases cortisol and belly fat.' },
      { title: '🍌 Pre-Workout Fuel', body: 'Eat a banana 30 minutes before workout for instant energy.' },
      { title: '💪 Protein Power', body: 'Eat protein within 30 minutes after workout for better muscle recovery.' },
      { title: '🚫 Sugar Alert', body: 'Reduce sugar intake today. Replace chai sugar with stevia or honey.' },
      { title: '🥜 Healthy Snacking', body: 'Replace chips with roasted makhana or mixed nuts for a healthier snack.' },
      { title: '📱 Posture Check', body: 'Straighten your back right now! Good posture prevents back pain and improves breathing.' },
    ];

    const tip = tips[Math.floor(Math.random() * tips.length)];
    const users = await User.find({ isActive: true }).select('_id expoPushToken');

    const notifications = users.map(u => ({
      user: u._id,
      title: tip.title,
      body: tip.body,
      type: 'tip',
    }));

    await Notification.insertMany(notifications);

    const pushTokens = users.map(u => u.expoPushToken).filter(Boolean);
    if (pushTokens.length > 0) {
      await sendExpoPush(pushTokens, tip.title, tip.body);
    }

    res.json({ success: true, message: `Tip sent to ${users.length} users (${pushTokens.length} push)`, tip });
  } catch (error) {
    next(error);
  }
};
