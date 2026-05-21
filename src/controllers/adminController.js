const mongoose = require('mongoose');
const User = require('../models/User');
const Workout = require('../models/Workout');
const DietPlan = require('../models/DietPlan');
const Subscription = require('../models/Subscription');
const Tracking = require('../models/Tracking');

// @desc    Dashboard stats
exports.getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, premiumUsers, totalWorkouts, totalDiets, activeSubscriptions, recentUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      Workout.countDocuments(),
      DietPlan.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      User.find().sort({ createdAt: -1 }).limit(10).select('name email isPremium createdAt'),
    ]);

    const revenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers,
        totalWorkouts, totalDiets, activeSubscriptions,
        totalRevenue: revenue[0]?.total ? revenue[0].total / 100 : 0,
        recentUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isPremium } = req.query;
    const filter = {};
    if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (isPremium !== undefined) filter.isPremium = isPremium === 'true';

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .skip((page - 1) * limit).limit(parseInt(limit))
      .sort({ createdAt: -1 }).select('-password');

    res.json({ success: true, count: users.length, total, page: parseInt(page), data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user details
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ChatMessage = require('../models/ChatMessage');
    const [subscriptions, recentTracking, totalChatMessages, totalWorkoutDays] = await Promise.all([
      Subscription.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(10),
      Tracking.find({ user: req.params.id }).sort({ date: -1 }).limit(14),
      ChatMessage.countDocuments({ user: req.params.id }),
      Tracking.countDocuments({ user: req.params.id, workoutCompleted: true }),
    ]);

    res.json({ success: true, data: { user, subscriptions, recentTracking, totalChatMessages, totalWorkoutDays } });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user premium
exports.togglePremium = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isPremium = !user.isPremium;
    if (user.isPremium) {
      user.subscriptionPlan = 'monthly';
      user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      user.subscriptionPlan = 'free';
      user.subscriptionExpiry = undefined;
    }
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate user
exports.deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all subscriptions
exports.getSubscriptions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [total, subs, statusCounts] = await Promise.all([
      Subscription.countDocuments(filter),
      Subscription.find(filter)
        .populate('user', 'name email phone')
        .skip((page - 1) * limit).limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Subscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      ]),
    ]);

    const stats = { all: 0, pending: 0, active: 0, cancelled: 0, expired: 0, totalRevenue: 0 };
    statusCounts.forEach(s => {
      stats[s._id] = s.count;
      stats.all += s.count;
      if (s._id === 'active') stats.totalRevenue = s.revenue;
    });

    res.json({ success: true, count: subs.length, total, page: parseInt(page), stats, data: subs });
  } catch (error) {
    next(error);
  }
};
