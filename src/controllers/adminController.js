const mongoose = require('mongoose');
const User = require('../models/User');
const Workout = require('../models/Workout');
const DietPlan = require('../models/DietPlan');
const Subscription = require('../models/Subscription');
const Tracking = require('../models/Tracking');
const Gym = require('../models/Gym');
const { sendLoginOtpEmail } = require('../utils/emailService');

// ===== GYM OWNER APPROVAL =====

// @desc  List gym-owner registration requests (default: pending)
exports.getOwnerRequests = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'all' ? { ownerStatus: { $in: ['pending', 'approved', 'rejected'] } } : { ownerStatus: status };
    const requests = await User.find(filter)
      .select('name email phone requestedGymName ownerStatus ownerRequestedAt role')
      .sort({ ownerRequestedAt: -1 });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (e) { next(e); }
};

// @desc  Approve a gym-owner request → promote to gym_owner, create their gym, email a login OTP
exports.approveOwnerRequest = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.ownerStatus !== 'pending') return res.status(400).json({ success: false, message: `Request is already ${user.ownerStatus}` });

    user.role = 'gym_owner';
    user.ownerStatus = 'approved';

    // Create their first gym from the requested name (if they have none yet)
    let gym = await Gym.findOne({ owner: user._id });
    if (!gym && user.requestedGymName) {
      gym = await Gym.create({ name: user.requestedGymName, owner: user._id, phone: user.phone });
    }

    // Email a login OTP so they can sign in right away ("sab clear")
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await user.save();
    try { await sendLoginOtpEmail(user.email, otp); } catch (e) { console.log('approval email failed:', e.message); }

    res.json({ success: true, message: 'Approved — login OTP emailed to the owner', data: { id: user._id, gym: gym?._id } });
  } catch (e) { next(e); }
};

// @desc  Reject a gym-owner request
exports.rejectOwnerRequest = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.ownerStatus = 'rejected';
    user.requestedGymName = undefined;
    await user.save();
    res.json({ success: true, message: 'Request rejected' });
  } catch (e) { next(e); }
};

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
    const user = await User.findById(req.params.id).select('-password -avatar');
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

// @desc    Approve UPI payment → activate premium
exports.approvePayment = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (subscription.status === 'active') return res.json({ success: true, message: 'Already active' });

    const startDate = new Date();
    const endDate = new Date();
    const plan = subscription.plan;
    if (plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    subscription.status = 'active';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.approvedAt = new Date();
    subscription.approvedBy = req.user.id;
    if (req.body.note) subscription.adminNote = req.body.note;
    await subscription.save();

    await User.findByIdAndUpdate(subscription.user, {
      isPremium: true,
      subscriptionPlan: plan,
      subscriptionExpiry: endDate,
    });

    res.json({ success: true, message: 'Payment approved, premium activated!', data: subscription });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject UPI payment
exports.rejectPayment = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });

    subscription.status = 'rejected';
    if (req.body.note) subscription.adminNote = req.body.note;
    await subscription.save();

    res.json({ success: true, message: 'Payment rejected', data: subscription });
  } catch (error) {
    next(error);
  }
};
