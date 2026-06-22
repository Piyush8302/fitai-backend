const Gym = require('../models/Gym');
const Membership = require('../models/Membership');
const GymAttendance = require('../models/GymAttendance');
const GymPayment = require('../models/GymPayment');
const User = require('../models/User');

// ---- helpers ----
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().split('T')[0];

const PLAN_MONTHS = { trial: 0, day_pass: 0, monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

const addMonths = (date, months) => {
  const d = new Date(date);
  if (months === 0) { d.setDate(d.getDate() + 2); return d; } // trial/day_pass ~2 days
  d.setMonth(d.getMonth() + months);
  return d;
};

// Gyms the current user can manage (owner: their gyms; staff: their one gym)
const myGymIds = async (user) => {
  if (user.role === 'gym_staff' && user.staffGym) return [String(user.staffGym)];
  const gyms = await Gym.find({ owner: user.id }).select('_id');
  return gyms.map(g => String(g._id));
};

const ownsGym = async (user, gymId) => {
  if (user.role === 'admin') return true;
  const ids = await myGymIds(user);
  return ids.includes(String(gymId));
};

// ===================== OWNER / STAFF =====================

// @desc  Create a gym (becomes a gym_owner)
exports.createGym = async (req, res, next) => {
  try {
    const { name, location, city, phone, lat, lng } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gym name required' });

    const gym = await Gym.create({ name, owner: req.user.id, location, city, phone, lat, lng });

    // Promote the creator to gym_owner (unless super admin)
    if (req.user.role === 'user') {
      await User.findByIdAndUpdate(req.user.id, { role: 'gym_owner' });
    }
    res.status(201).json({ success: true, data: gym });
  } catch (e) { next(e); }
};

// @desc  My gyms (owner) or my gym (staff)
exports.getMyGyms = async (req, res, next) => {
  try {
    const ids = await myGymIds(req.user);
    const gyms = await Gym.find({ _id: { $in: ids } }).sort({ createdAt: 1 });
    res.json({ success: true, count: gyms.length, data: gyms });
  } catch (e) { next(e); }
};

// @desc  Add a member to a gym (find user by phone or create minimal)
exports.addMember = async (req, res, next) => {
  try {
    const { gymId, name, phone, plan = 'monthly', fee = 0 } = req.body;
    if (!gymId || !phone) return res.status(400).json({ success: false, message: 'gymId and phone required' });
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    // Find existing user by phone, else create a lightweight one
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        name: name || 'Member',
        phone,
        email: `g_${phone}_${Date.now()}@fitai.local`, // placeholder, unique
        role: 'user',
      });
    }

    // Existing membership?
    let membership = await Membership.findOne({ user: user._id, gym: gymId });
    if (membership) {
      return res.json({ success: true, message: 'Already a member', data: membership, alreadyMember: true });
    }

    const months = PLAN_MONTHS[plan] ?? 1;
    membership = await Membership.create({
      user: user._id, gym: gymId, plan, fee,
      joinDate: new Date(),
      dueDate: addMonths(new Date(), months),
      status: 'active',
      addedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: membership });
  } catch (e) { next(e); }
};

// @desc  Members of a gym (with user info + payment status)
exports.getMembers = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const memberships = await Membership.find({ gym: gymId })
      .populate('user', 'name phone avatar')
      .sort({ createdAt: -1 });

    const now = new Date();
    const data = memberships.map(m => ({
      _id: m._id,
      user: m.user,
      plan: m.plan,
      fee: m.fee,
      joinDate: m.joinDate,
      dueDate: m.dueDate,
      lastPaidDate: m.lastPaidDate,
      status: m.status,
      isDue: m.dueDate ? new Date(m.dueDate) < now : false,
    }));
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

// @desc  Mark a payment (cash collected offline)
exports.markPayment = async (req, res, next) => {
  try {
    const { membershipId, amount, plan, periodMonths } = req.body;
    const membership = await Membership.findById(membershipId);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });
    if (!(await ownsGym(req.user, membership.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const months = periodMonths || PLAN_MONTHS[plan || membership.plan] || 1;
    const payment = await GymPayment.create({
      user: membership.user, gym: membership.gym, membership: membership._id,
      amount, plan: plan || membership.plan, periodMonths: months, markedBy: req.user.id,
    });

    membership.lastPaidDate = new Date();
    membership.dueDate = addMonths(new Date(), months);
    membership.status = 'active';
    if (plan) membership.plan = plan;
    if (amount) membership.fee = amount;
    await membership.save();

    res.status(201).json({ success: true, data: { payment, membership } });
  } catch (e) { next(e); }
};

// @desc  Mark attendance for a member (staff scans member QR → userId)
exports.markAttendance = async (req, res, next) => {
  try {
    const { gymId, userId } = req.body;
    if (!gymId || !userId) return res.status(400).json({ success: false, message: 'gymId and userId required' });
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    // Open model: if not a member yet, auto-create a trial membership
    let membership = await Membership.findOne({ user: userId, gym: gymId });
    if (!membership) {
      membership = await Membership.create({
        user: userId, gym: gymId, plan: 'trial', fee: 0,
        joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active', addedBy: req.user.id,
      });
    }

    const day = istDay();
    try {
      const att = await GymAttendance.create({
        user: userId, gym: gymId, membership: membership._id,
        day, method: 'staff_scan', markedBy: req.user.id,
      });
      const u = await User.findById(userId).select('name phone');
      return res.status(201).json({ success: true, message: 'Attendance marked', data: { att, member: u, newMember: membership.plan === 'trial' && !membership.lastPaidDate } });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        const u = await User.findById(userId).select('name phone');
        return res.json({ success: true, message: 'Already checked in today', data: { member: u, duplicate: true } });
      }
      throw dupErr;
    }
  } catch (e) { next(e); }
};

// @desc  Gym dashboard stats
exports.getGymDashboard = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const now = new Date();
    const day = istDay();
    const [totalMembers, todayFootfall, dueMembers] = await Promise.all([
      Membership.countDocuments({ gym: gymId }),
      GymAttendance.countDocuments({ gym: gymId, day }),
      Membership.find({ gym: gymId, dueDate: { $lt: now } }).countDocuments(),
    ]);
    // Pending fee sum (members whose due date passed)
    const dueList = await Membership.find({ gym: gymId, dueDate: { $lt: now } }).select('fee');
    const pendingFees = dueList.reduce((s, m) => s + (m.fee || 0), 0);

    res.json({ success: true, data: { totalMembers, todayFootfall, dueMembers, pendingFees } });
  } catch (e) { next(e); }
};

// @desc  Attendance list for a gym (filter by day or by member)
exports.getGymAttendance = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const { day, userId } = req.query;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const filter = { gym: gymId };
    if (day) filter.day = day;
    if (userId) filter.user = userId;
    const list = await GymAttendance.find(filter).populate('user', 'name phone').sort({ checkInAt: -1 }).limit(200);

    // Count this month's check-ins (useful when filtering by member)
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const thisMonth = list.filter(a => new Date(a.checkInAt) >= monthStart).length;

    res.json({ success: true, count: list.length, thisMonth, data: list });
  } catch (e) { next(e); }
};

// ===================== MEMBER (the gym-goer) =====================

// @desc  My membership card data + all my gyms
exports.getMyCard = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.user.id })
      .populate('gym', 'name location city')
      .sort({ createdAt: -1 });
    const now = new Date();
    const gyms = memberships.map(m => ({
      membershipId: m._id,
      gym: m.gym,
      plan: m.plan,
      status: m.status,
      dueDate: m.dueDate,
      isDue: m.dueDate ? new Date(m.dueDate) < now : false,
    }));
    res.json({
      success: true,
      data: {
        // QR / barcode payload = stable user id
        qrValue: `FITAI-USER:${req.user.id}`,
        userId: req.user.id,
        name: req.user.name,
        phone: req.user.phone,
        gyms,
      },
    });
  } catch (e) { next(e); }
};

// @desc  My attendance history for one gym
exports.getMyAttendance = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const list = await GymAttendance.find({ user: req.user.id, gym: gymId }).sort({ checkInAt: -1 }).limit(100);
    res.json({ success: true, count: list.length, data: list });
  } catch (e) { next(e); }
};

// @desc  Member self check-in by scanning a gym's QR (gymCode)
exports.selfCheckIn = async (req, res, next) => {
  try {
    const { gymCode } = req.body;
    const gym = await Gym.findOne({ gymCode });
    if (!gym) return res.status(404).json({ success: false, message: 'Invalid gym QR' });

    // Open model: auto-create membership if none
    let membership = await Membership.findOne({ user: req.user.id, gym: gym._id });
    if (!membership) {
      membership = await Membership.create({
        user: req.user.id, gym: gym._id, plan: 'trial', fee: 0,
        joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active',
      });
    }
    const day = istDay();
    try {
      await GymAttendance.create({
        user: req.user.id, gym: gym._id, membership: membership._id, day, method: 'self_scan',
      });
      return res.status(201).json({ success: true, message: `Checked in at ${gym.name}`, data: { gym: gym.name } });
    } catch (dupErr) {
      if (dupErr.code === 11000) return res.json({ success: true, message: `Already checked in at ${gym.name} today`, data: { gym: gym.name, duplicate: true } });
      throw dupErr;
    }
  } catch (e) { next(e); }
};

module.exports = exports;
