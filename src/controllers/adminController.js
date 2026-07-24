const mongoose = require('mongoose');
const User = require('../models/User');
const Workout = require('../models/Workout');
const DietPlan = require('../models/DietPlan');
const Subscription = require('../models/Subscription');
const Tracking = require('../models/Tracking');
const Gym = require('../models/Gym');
const { sendOwnerApprovedEmail } = require('../utils/emailService');

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
    await user.save();

    // Create their first gym from the requested name (if they have none yet)
    let gym = await Gym.findOne({ owner: user._id });
    if (!gym && user.requestedGymName) {
      gym = await Gym.create({ name: user.requestedGymName, owner: user._id, phone: user.phone });
    }

    // Notify the owner they're approved. No OTP here — when they log in, the normal
    // login flow sends a fresh OTP (a pre-sent OTP would just get overwritten).
    try { await sendOwnerApprovedEmail(user.email, user.name); } catch (e) { console.log('approval email failed:', e.message); }

    res.json({ success: true, message: 'Approved — owner notified by email', data: { id: user._id, gym: gym?._id } });
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
    const Membership = require('../models/Membership');
    const GymPayment = require('../models/GymPayment');
    const Article = require('../models/Article');

    const [totalUsers, premiumUsers, totalWorkouts, totalDiets, totalArticles, activeSubscriptions, recentUsers,
      totalGyms, activeGyms, totalGymMembers, pendingOwnerRequests] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      Workout.countDocuments(),
      DietPlan.countDocuments(),
      Article.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      User.find().sort({ createdAt: -1 }).limit(10).select('name email isPremium createdAt'),
      Gym.countDocuments(),
      Gym.countDocuments({ isActive: { $ne: false } }),
      Membership.countDocuments(),
      User.countDocuments({ ownerStatus: 'pending' }),
    ]);

    const [revenue, gymRevenueAgg] = await Promise.all([
      Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      GymPayment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers,
        totalWorkouts,
        totalDiets, totalDietPlans: totalDiets, // admin UI reads totalDietPlans
        totalArticles,
        activeSubscriptions,
        totalRevenue: revenue[0]?.total ? revenue[0].total / 100 : 0,
        // Gym platform KPIs
        totalGyms, activeGyms,
        suspendedGyms: totalGyms - activeGyms,
        totalGymMembers,
        gymRevenue: gymRevenueAgg[0]?.total || 0, // gym membership payments (already in ₹)
        pendingOwnerRequests,
        recentUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== GYMS (platform-wide oversight) =====

// @desc  List every gym on the platform with owner, members count & revenue.
//        Supports ?search= (name/city/owner) and ?status=active|suspended + pagination.
exports.getGyms = async (req, res, next) => {
  try {
    const Membership = require('../models/Membership');
    const GymPayment = require('../models/GymPayment');
    const { page = 1, limit = 20, search = '', status } = req.query;

    const filter = {};
    if (status === 'active') filter.isActive = { $ne: false };
    else if (status === 'suspended') filter.isActive = false;
    else if (status === 'requested') { filter.isActive = false; filter.reactivationRequested = true; }
    if (search) {
      const rx = new RegExp(search.trim(), 'i');
      // Match gyms by name/city/code, or by their owner's name/phone.
      const owners = await User.find({ $or: [{ name: rx }, { phone: rx }] }).select('_id');
      filter.$or = [{ name: rx }, { city: rx }, { gymCode: rx }, { owner: { $in: owners.map(o => o._id) } }];
    }

    const total = await Gym.countDocuments(filter);
    const gyms = await Gym.find(filter)
      .populate('owner', 'name phone email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(parseInt(limit))
      .lean();

    // Members + revenue per gym in two grouped queries (fast, no N+1).
    const ids = gyms.map(g => g._id);
    const [memberAgg, revAgg] = await Promise.all([
      Membership.aggregate([{ $match: { gym: { $in: ids } } }, { $group: { _id: '$gym', c: { $sum: 1 } } }]),
      GymPayment.aggregate([{ $match: { gym: { $in: ids } } }, { $group: { _id: '$gym', total: { $sum: '$amount' } } }]),
    ]);
    const memberMap = Object.fromEntries(memberAgg.map(m => [String(m._id), m.c]));
    const revMap = Object.fromEntries(revAgg.map(r => [String(r._id), r.total]));

    const data = gyms.map(g => ({
      _id: g._id,
      name: g.name,
      city: g.city || '',
      gymCode: g.gymCode,
      phone: g.phone || '',
      isActive: g.isActive !== false,
      reactivationRequested: !!g.reactivationRequested,
      hasLocation: g.lat != null && g.lng != null,
      owner: g.owner ? { _id: g.owner._id, name: g.owner.name, phone: g.owner.phone, email: g.owner.email } : null,
      members: memberMap[String(g._id)] || 0,
      revenue: revMap[String(g._id)] || 0,
      createdAt: g.createdAt,
    }));

    res.json({ success: true, count: data.length, total, page: parseInt(page), pages: Math.ceil(total / limit), data });
  } catch (e) { next(e); }
};

// @desc  One gym's full picture: info, owner, staff, members, revenue & attendance today.
exports.getGymDetail = async (req, res, next) => {
  try {
    const Membership = require('../models/Membership');
    const GymPayment = require('../models/GymPayment');
    const GymAttendance = require('../models/GymAttendance');
    const gym = await Gym.findById(req.params.id).populate('owner', 'name phone email staffStatus').lean();
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });

    const istDay = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
    const [staff, memberships, revAgg, todayCount] = await Promise.all([
      User.find({ role: 'gym_staff', staffGym: gym._id }).select('name phone staffRole staffStatus').lean(),
      Membership.find({ gym: gym._id }).populate('user', 'name phone avatar').sort({ createdAt: -1 }).limit(50).lean(),
      GymPayment.aggregate([{ $match: { gym: gym._id } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      GymAttendance.countDocuments({ gym: gym._id, day: istDay }),
    ]);

    const totalMembers = await Membership.countDocuments({ gym: gym._id });
    const activeMembers = await Membership.countDocuments({ gym: gym._id, status: 'active' });

    res.json({
      success: true,
      data: {
        gym: {
          _id: gym._id, name: gym.name, city: gym.city, location: gym.location, phone: gym.phone,
          gymCode: gym.gymCode, isActive: gym.isActive !== false, hasLocation: gym.lat != null && gym.lng != null,
          reactivationRequested: !!gym.reactivationRequested, reactivationNote: gym.reactivationNote || '',
          slots: gym.slots || [], planPrices: gym.planPrices || {}, createdAt: gym.createdAt,
        },
        owner: gym.owner,
        stats: {
          totalMembers, activeMembers, staffCount: staff.length,
          revenue: revAgg[0]?.total || 0, payments: revAgg[0]?.count || 0,
          checkinsToday: todayCount,
        },
        staff,
        members: memberships.map(m => ({
          _id: m._id, user: m.user, plan: m.plan, fee: m.fee, status: m.status,
          dueDate: m.dueDate, joinDate: m.joinDate,
        })),
      },
    });
  } catch (e) { next(e); }
};

// @desc  Suspend or re-activate a gym (isActive). A suspended gym is disabled platform-wide.
exports.toggleGymActive = async (req, res, next) => {
  try {
    const gym = await Gym.findById(req.params.id);
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });
    gym.isActive = gym.isActive === false; // flip: false → true, true/undefined → false
    if (gym.isActive) { gym.reactivationRequested = false; gym.reactivationRequestedAt = undefined; gym.reactivationNote = undefined; }
    await gym.save();

    // Tell the owner the outcome (in-app + push).
    try {
      const owner = await User.findById(gym.owner).select('_id expoPushToken');
      if (owner) {
        const Notification = require('../models/Notification');
        const { sendExpoPush } = require('../utils/push');
        const title = gym.isActive ? `✅ ${gym.name} reactivated` : `⛔ ${gym.name} suspended`;
        const body = gym.isActive
          ? 'Your gym has been reactivated by FitAI admin. Everything is back to normal.'
          : 'Your gym has been suspended by FitAI admin. Open the gym in the app to request reactivation.';
        await Notification.create({ user: owner._id, title, body, type: gym.isActive ? 'success' : 'warning', data: { kind: 'gym_status', screen: 'GymAdmin' } });
        if (owner.expoPushToken) await sendExpoPush([owner.expoPushToken], title, body, { screen: 'GymAdmin' });
        await require('../utils/webPush').sendWebPushToUsers([owner._id], { title, body, data: { kind: 'gym_status', screen: 'GymAdmin' } }).catch(() => {});
      }
    } catch (e) { console.log('gym status notify error:', e.message); }

    res.json({ success: true, message: gym.isActive ? 'Gym activated' : 'Gym suspended', data: { _id: gym._id, isActive: gym.isActive } });
  } catch (e) { next(e); }
};

// @desc  Permanently delete a gym and everything scoped to it (members' gym
//        links, payments, attendance, cashbook). The people themselves keep
//        their accounts — only their link to THIS gym goes away.
exports.deleteGym = async (req, res, next) => {
  try {
    const Membership = require('../models/Membership');
    const GymPayment = require('../models/GymPayment');
    const GymAttendance = require('../models/GymAttendance');
    const GymCashbook = require('../models/GymCashbook');
    const StaffAttendance = require('../models/StaffAttendance');

    const gym = await Gym.findById(req.params.id);
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });
    const gymName = gym.name;

    const [members, payments, attendance, cashbook] = await Promise.all([
      Membership.deleteMany({ gym: gym._id }),
      GymPayment.deleteMany({ gym: gym._id }),
      GymAttendance.deleteMany({ gym: gym._id }),
      GymCashbook.deleteMany({ gym: gym._id }),
      StaffAttendance.deleteMany({ gym: gym._id }).catch(() => ({})),
    ]);
    // Staff of this gym become ordinary users again (accounts are kept).
    await User.updateMany(
      { role: 'gym_staff', staffGym: gym._id },
      { $set: { role: 'user' }, $unset: { staffGym: 1, staffRole: 1 } }
    );
    await gym.deleteOne();

    // Let the owner know their gym is gone (in-app + push).
    try {
      const owner = await User.findById(gym.owner).select('_id expoPushToken');
      if (owner) {
        const Notification = require('../models/Notification');
        const { sendExpoPush } = require('../utils/push');
        const title = `🗑️ ${gymName} removed`;
        const body = 'This gym has been permanently removed by FitAI admin. Contact support if this was unexpected.';
        await Notification.create({ user: owner._id, title, body, type: 'warning', data: { kind: 'gym_deleted' } });
        if (owner.expoPushToken) await sendExpoPush([owner.expoPushToken], title, body, {});
        await require('../utils/webPush').sendWebPushToUsers([owner._id], { title, body, data: { kind: 'gym_deleted' } }).catch(() => {});
      }
    } catch (e) { console.log('gym delete notify error:', e.message); }

    res.json({
      success: true,
      message: `"${gymName}" deleted`,
      data: {
        memberships: members.deletedCount || 0, payments: payments.deletedCount || 0,
        attendance: attendance.deletedCount || 0, cashbook: cashbook.deletedCount || 0,
      },
    });
  } catch (e) { next(e); }
};

// @desc  Permanently delete a user and their personal data.
//        Gym PAYMENTS are deliberately kept — they are the gym's financial
//        record, not the member's, and removing them would rewrite its books.
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Admin accounts cannot be deleted' });
    }
    // An owner's gyms must go first, else the gym, its members and its ledger
    // would be left with no owner.
    const owned = await Gym.countDocuments({ owner: user._id });
    if (owned > 0) {
      return res.status(409).json({
        success: false,
        message: `This user owns ${owned} gym${owned > 1 ? 's' : ''}. Delete the gym${owned > 1 ? 's' : ''} first, then the account.`,
      });
    }

    const name = user.name || 'User';
    const Membership = require('../models/Membership');
    const GymAttendance = require('../models/GymAttendance');
    const Notification = require('../models/Notification');
    const ChatMessage = require('../models/ChatMessage');
    const Favorite = require('../models/Favorite');
    const Achievement = require('../models/Achievement');
    await Promise.all([
      Membership.deleteMany({ user: user._id }),
      GymAttendance.deleteMany({ user: user._id }),
      Tracking.deleteMany({ user: user._id }),
      Subscription.deleteMany({ user: user._id }),
      Notification.deleteMany({ user: user._id }),
      ChatMessage.deleteMany({ user: user._id }),
      Favorite.deleteMany({ user: user._id }),
      Achievement.deleteMany({ user: user._id }),
    ]);
    await user.deleteOne();

    res.json({ success: true, message: `${name} deleted permanently` });
  } catch (e) { next(e); }
};

// Attach each user's gym links so the admin panel can show WHICH gym a person
// belongs to. One user can appear as a member of some gyms, the owner of others,
// and staff at one — so `gyms` is a list of { _id, name, gymCode, as }.
// Takes and returns plain objects (call .lean() on the query).
const attachGyms = async (users) => {
  if (!users.length) return users;
  const Membership = require('../models/Membership');
  const ids = users.map((u) => u._id);
  const staffGymIds = users.map((u) => u.staffGym).filter(Boolean);

  const [memberships, ownedGyms, staffGyms] = await Promise.all([
    Membership.find({ user: { $in: ids } }).select('user gym status').populate('gym', 'name gymCode').lean(),
    Gym.find({ owner: { $in: ids } }).select('name gymCode owner').lean(),
    staffGymIds.length ? Gym.find({ _id: { $in: staffGymIds } }).select('name gymCode').lean() : [],
  ]);

  const byUser = new Map(ids.map((id) => [String(id), []]));
  for (const m of memberships) {
    if (!m.gym) continue; // gym was deleted
    byUser.get(String(m.user))?.push({ _id: m.gym._id, name: m.gym.name, gymCode: m.gym.gymCode, as: 'member', status: m.status });
  }
  for (const g of ownedGyms) {
    byUser.get(String(g.owner))?.push({ _id: g._id, name: g.name, gymCode: g.gymCode, as: 'owner' });
  }
  const staffById = new Map(staffGyms.map((g) => [String(g._id), g]));
  for (const u of users) {
    const g = u.staffGym && staffById.get(String(u.staffGym));
    if (g) byUser.get(String(u._id))?.push({ _id: g._id, name: g.name, gymCode: g.gymCode, as: 'staff' });
  }
  return users.map((u) => ({ ...u, gyms: byUser.get(String(u._id)) || [] }));
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
      .sort({ createdAt: -1 }).select('-password').lean();

    res.json({ success: true, count: users.length, total, page: parseInt(page), data: await attachGyms(users) });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user details
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -avatar').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const [withGyms] = await attachGyms([user]);

    const ChatMessage = require('../models/ChatMessage');
    const [subscriptions, recentTracking, totalChatMessages, totalWorkoutDays] = await Promise.all([
      Subscription.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(10),
      Tracking.find({ user: req.params.id }).sort({ date: -1 }).limit(14),
      ChatMessage.countDocuments({ user: req.params.id }),
      Tracking.countDocuments({ user: req.params.id, workoutCompleted: true }),
    ]);

    res.json({ success: true, data: { user: withGyms, subscriptions, recentTracking, totalChatMessages, totalWorkoutDays } });
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

// @desc    Update a user's email and/or phone (admin handles change requests).
//          Owners/staff/users can't self-change contact for security — they send a
//          support request and the super-admin applies it here, with uniqueness checks.
exports.updateUserContact = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Provide a new email or phone' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (email !== undefined && email !== '') {
      const e = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
      }
      const dup = await User.findOne({ email: e, _id: { $ne: user._id } });
      if (dup) return res.status(409).json({ success: false, message: 'That email is already used by another account' });
      user.email = e;
    }

    if (phone !== undefined && phone !== '') {
      const p = String(phone).replace(/\D/g, '');
      if (p.length < 10) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone' });
      const dup = await User.findOne({ phone: p, _id: { $ne: user._id } });
      if (dup) return res.status(409).json({ success: false, message: 'That phone is already used by another account' });
      user.phone = p;
    }

    await user.save();
    res.json({ success: true, message: 'Contact details updated', data: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
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
