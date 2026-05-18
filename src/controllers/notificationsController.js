const Notification = require('../models/Notification');

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

// @desc    Send notification (internal helper, also used by admin)
exports.sendNotification = async (req, res, next) => {
  try {
    const { userId, title, body, type, data } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ success: false, message: 'Provide userId, title, and body' });
    }

    const notification = await Notification.create({ user: userId, title, body, type: type || 'tip', data });
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
    const User = require('../models/User');
    const users = await User.find({ isActive: true }).select('_id');

    const notifications = users.map(u => ({
      user: u._id,
      title: tip.title,
      body: tip.body,
      type: 'tip',
    }));

    await Notification.insertMany(notifications);
    res.json({ success: true, message: `Tip sent to ${users.length} users`, tip });
  } catch (error) {
    next(error);
  }
};
