const Gym = require('../models/Gym');
const Membership = require('../models/Membership');
const GymAttendance = require('../models/GymAttendance');
const GymPayment = require('../models/GymPayment');
const GymCashbook = require('../models/GymCashbook');
const StaffAttendance = require('../models/StaffAttendance');
const User = require('../models/User');
const { notifyUsers } = require('../utils/push');

// ---- helpers ----
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().split('T')[0];

// Public base URL of this backend — used to build avatar image URLs for push.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://fitai-backend-icbh.onrender.com';

// Notify a gym's owner + all its staff (in-app + push). `excludeUserId` skips
// the person who triggered the action (e.g. the staff who added the member).
const notifyGymTeam = async (gymId, { title, body, type = 'info', data = {}, imageUrl, excludeUserId } = {}) => {
  try {
    const gym = await Gym.findById(gymId).select('owner');
    if (!gym) return;
    const [owner, staff] = await Promise.all([
      User.findById(gym.owner).select('_id expoPushToken'),
      User.find({ role: 'gym_staff', staffGym: gymId }).select('_id expoPushToken'),
    ]);
    let recipients = [owner, ...staff].filter(Boolean);
    if (excludeUserId) recipients = recipients.filter(u => String(u._id) !== String(excludeUserId));
    await notifyUsers(recipients, { title, body, type, data: { screen: 'GymAdmin', ...data }, imageUrl });
  } catch (e) { console.log('notifyGymTeam error:', e.message); }
};

// Build the "new member joined" notification for a gym's team.
// `member` = { id, name, phone, avatar }. The base64 avatar is carried in `data`
// (for the in-app list) and also served as an image URL for the push thumbnail.
const announceNewMember = (gymId, gymName, member = {}, excludeUserId) => {
  const hasPhoto = member.avatar && String(member.avatar).startsWith('data:');
  const imageUrl = hasPhoto && member.id ? `${PUBLIC_BASE_URL}/api/gym/avatar/${member.id}` : undefined;
  return notifyGymTeam(gymId, {
    title: `🆕 New member at ${gymName || 'your gym'}`,
    body: `${member.name || 'A new member'}${member.phone ? ` (${member.phone})` : ''} just joined. 🎉`,
    type: 'success',
    data: { kind: 'new_member', gym: gymName, memberName: member.name, avatar: member.avatar || undefined },
    imageUrl,
    excludeUserId,
  });
};

// "Payment received" notification for a gym's team (with member's photo).
const announcePayment = (gymId, gymName, member = {}, amount, planLabel, excludeUserId) => {
  const hasPhoto = member.avatar && String(member.avatar).startsWith('data:');
  const imageUrl = hasPhoto && member.id ? `${PUBLIC_BASE_URL}/api/gym/avatar/${member.id}` : undefined;
  return notifyGymTeam(gymId, {
    title: `💵 Payment received — ${gymName || 'your gym'}`,
    body: `${member.name || 'A member'} paid ₹${amount}${planLabel ? ` (${planLabel})` : ''}. ✅`,
    type: 'success',
    data: { kind: 'payment', gym: gymName, memberName: member.name, avatar: member.avatar || undefined, amount },
    imageUrl,
    excludeUserId,
  });
};

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

// @desc  Serve a user's avatar as a real image (so push thumbnails can use a URL).
//        Public — Expo fetches it from the device with no auth header.
exports.getAvatarImage = async (req, res) => {
  try {
    const u = await User.findById(req.params.userId).select('avatar');
    const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(u?.avatar || '');
    if (!m) return res.status(404).send('No image');
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(m[2], 'base64'));
  } catch (e) { return res.status(500).send('error'); }
};

// ===================== OWNER / STAFF =====================

// @desc  Create a gym (becomes a gym_owner)
exports.createGym = async (req, res, next) => {
  try {
    const { name, location, city, phone, lat, lng, ownerPhone } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gym name required' });

    // A gym owner must have a mobile number on file. If they don't have one yet
    // (e.g. signed up with email), require it while creating the gym.
    if (!req.user.phone) {
      const op = String(ownerPhone || '').replace(/\D/g, '');
      if (op.length < 10) return res.status(400).json({ success: false, message: 'Owner mobile number is required' });
      const taken = await User.findOne({ phone: op, _id: { $ne: req.user.id } });
      if (taken) return res.status(400).json({ success: false, message: 'This mobile number is already in use' });
      await User.findByIdAndUpdate(req.user.id, { phone: op });
    }

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
    const { gymId, name, phone, plan = 'monthly', fee = 0, avatar } = req.body;
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
        avatar: avatar || '',
      });
    } else if (avatar && !user.avatar) {
      try { user.avatar = avatar; await user.save(); } catch (e) {}
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
    // Notify owner + staff (skip whoever added the member)
    const gym = await Gym.findById(gymId).select('name');
    announceNewMember(gymId, gym?.name, { id: user._id, name: user.name, phone: user.phone, avatar: user.avatar }, req.user.id);
    res.status(201).json({ success: true, data: membership });
  } catch (e) { next(e); }
};

// ===================== STAFF =====================

// @desc  Add a staff member to a gym. Find user by phone or create a new one.
exports.addStaff = async (req, res, next) => {
  try {
    const { gymId, name, phone, staffRole, salary, avatar } = req.body;
    if (!gymId || !phone) return res.status(400).json({ success: false, message: 'gymId and phone required' });
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) return res.status(400).json({ success: false, message: 'Valid phone required' });

    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({
        name: name || 'Staff', phone: cleanPhone,
        email: `s_${cleanPhone}_${Date.now()}@fitai.local`,
        role: 'gym_staff', staffGym: gymId, staffRole, staffSalary: salary,
        staffJoinDate: new Date(), avatar: avatar || '',
      });
    } else {
      // Don't hijack an owner/admin account
      if (['admin', 'gym_owner'].includes(user.role)) {
        return res.status(400).json({ success: false, message: 'This number belongs to an owner/admin account' });
      }
      user.role = 'gym_staff';
      user.staffGym = gymId;
      if (name) user.name = name;
      if (staffRole !== undefined) user.staffRole = staffRole;
      if (salary !== undefined) user.staffSalary = salary;
      if (avatar && !user.avatar) user.avatar = avatar;
      if (!user.staffJoinDate) user.staffJoinDate = new Date();
      await user.save();
    }
    res.status(201).json({
      success: true,
      data: { _id: user._id, name: user.name, phone: user.phone, staffRole: user.staffRole, staffSalary: user.staffSalary, avatar: user.avatar },
    });
  } catch (e) { next(e); }
};

// @desc  List a gym's staff + today's presence + this-month attendance count
exports.getStaff = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const staff = await User.find({ role: 'gym_staff', staffGym: gymId })
      .select('name phone avatar staffRole staffSalary staffJoinDate').sort({ createdAt: -1 });
    const day = istDay();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const data = await Promise.all(staff.map(async (s) => {
      const [todayRec, monthCount] = await Promise.all([
        StaffAttendance.findOne({ staff: s._id, gym: gymId, day }),
        StaffAttendance.countDocuments({ staff: s._id, gym: gymId, checkInAt: { $gte: monthStart } }),
      ]);
      return {
        _id: s._id, name: s.name, phone: s.phone, avatar: s.avatar,
        staffRole: s.staffRole, staffSalary: s.staffSalary, staffJoinDate: s.staffJoinDate,
        presentToday: !!todayRec, checkInAt: todayRec?.checkInAt || null, monthCount,
      };
    }));
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

// @desc  Remove a staff member (revert account to a normal user)
exports.removeStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'gym_staff') return res.status(404).json({ success: false, message: 'Staff not found' });
    if (!(await ownsGym(req.user, staff.staffGym))) return res.status(403).json({ success: false, message: 'Not your gym' });
    staff.role = 'user';
    staff.staffGym = undefined;
    staff.staffRole = undefined;
    staff.staffSalary = undefined;
    await staff.save();
    res.json({ success: true, message: 'Staff removed' });
  } catch (e) { next(e); }
};

// @desc  Mark a staff member present at the reception (dedupe per day)
exports.markStaffAttendance = async (req, res, next) => {
  try {
    const { gymId, staffId } = req.body;
    if (!gymId || !staffId) return res.status(400).json({ success: false, message: 'gymId and staffId required' });
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const staff = await User.findOne({ _id: staffId, role: 'gym_staff', staffGym: gymId }).select('name');
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found in this gym' });

    const day = istDay();
    try {
      const att = await StaffAttendance.create({ staff: staffId, gym: gymId, day, method: 'reception', markedBy: req.user.id });
      return res.status(201).json({ success: true, message: 'Staff marked present', data: { att, staff: { name: staff.name } } });
    } catch (dupErr) {
      if (dupErr.code === 11000) return res.json({ success: true, message: 'Already marked present today', data: { duplicate: true, staff: { name: staff.name } } });
      throw dupErr;
    }
  } catch (e) { next(e); }
};

// @desc  A staff member's attendance history (this-month count + recent list)
exports.getStaffAttendance = async (req, res, next) => {
  try {
    const { gymId, staffId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const list = await StaffAttendance.find({ gym: gymId, staff: staffId }).sort({ checkInAt: -1 }).limit(200);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const thisMonth = list.filter(a => new Date(a.checkInAt) >= monthStart).length;
    res.json({ success: true, count: list.length, thisMonth, data: list });
  } catch (e) { next(e); }
};

// ===================== ALL BRANCHES (combined) =====================

// @desc  All members across ALL of the owner's gyms (each tagged with its gym)
exports.getAllMembers = async (req, res, next) => {
  try {
    const ids = await myGymIds(req.user);
    const memberships = await Membership.find({ gym: { $in: ids } })
      .populate('user', 'name phone email avatar')
      .populate('gym', 'name')
      .sort({ createdAt: -1 });
    const now = new Date();
    const data = memberships.map(m => ({
      _id: m._id,
      user: m.user,
      gym: m.gym,            // { _id, name } — which branch
      plan: m.plan,
      fee: m.fee,
      joinDate: m.joinDate,
      dueDate: m.dueDate,
      status: m.status,
      isDue: m.dueDate ? new Date(m.dueDate) < now : false,
    }));
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

// @desc  Combined dashboard across all branches
exports.getAllDashboard = async (req, res, next) => {
  try {
    const ids = await myGymIds(req.user);
    const now = new Date();
    const day = istDay();
    const [totalMembers, todayFootfall, dueList] = await Promise.all([
      Membership.countDocuments({ gym: { $in: ids } }),
      GymAttendance.countDocuments({ gym: { $in: ids }, day }),
      Membership.find({ gym: { $in: ids }, dueDate: { $lt: now } }).select('fee'),
    ]);
    const pendingFees = dueList.reduce((s, m) => s + (m.fee || 0), 0);
    res.json({ success: true, data: { totalMembers, todayFootfall, dueMembers: dueList.length, pendingFees, branches: ids.length } });
  } catch (e) { next(e); }
};

// @desc  Combined cashbook across all branches (for a month)
exports.getAllCashbook = async (req, res, next) => {
  try {
    const ids = await myGymIds(req.user);
    const { month } = req.query;
    let start, end;
    if (month) { start = new Date(`${month}-01T00:00:00`); end = new Date(start); end.setMonth(end.getMonth() + 1); }
    else { start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); end = new Date(start); end.setMonth(end.getMonth() + 1); }
    const entries = await GymCashbook.find({ gym: { $in: ids }, date: { $gte: start, $lt: end } }).populate('gym', 'name').sort({ date: -1 });
    const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    res.json({ success: true, data: { entries, income, expense, balance: income - expense } });
  } catch (e) { next(e); }
};

// @desc  Members of a gym (with user info + payment status)
exports.getMembers = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const memberships = await Membership.find({ gym: gymId })
      .populate('user', 'name phone email avatar')
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

// @desc  Full member detail — profile + attendance + payment history
exports.getMemberDetail = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const membership = await Membership.findById(membershipId).populate('user', 'name phone email avatar createdAt');
    if (!membership) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!(await ownsGym(req.user, membership.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const now = new Date();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [attendance, payments, thisMonth] = await Promise.all([
      GymAttendance.find({ gym: membership.gym, user: membership.user._id }).sort({ checkInAt: -1 }).limit(366),
      GymPayment.find({ gym: membership.gym, user: membership.user._id }).sort({ paidDate: -1 }).limit(30),
      GymAttendance.countDocuments({ gym: membership.gym, user: membership.user._id, checkInAt: { $gte: monthStart } }),
    ]);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      success: true,
      data: {
        membership: {
          _id: membership._id,
          user: membership.user,
          plan: membership.plan,
          fee: membership.fee,
          joinDate: membership.joinDate,
          dueDate: membership.dueDate,
          lastPaidDate: membership.lastPaidDate,
          status: membership.status,
          isDue: membership.dueDate ? new Date(membership.dueDate) < now : false,
        },
        attendance,
        payments,
        thisMonth,
        totalPaid,
        totalCheckins: attendance.length,
      },
    });
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

    const finalPlan = plan || membership.plan;
    membership.lastPaidDate = new Date();
    membership.dueDate = addMonths(new Date(), months);
    membership.status = 'active';
    if (plan) membership.plan = plan;
    if (amount) membership.fee = amount;
    await membership.save();

    // Member + gym info (for the cashbook entry and the team notification)
    const [member, gym] = await Promise.all([
      User.findById(membership.user).select('name phone avatar'),
      Gym.findById(membership.gym).select('name'),
    ]);

    // Auto-add this payment to the cashbook as income (so owner doesn't re-enter)
    if (amount > 0) {
      await GymCashbook.create({
        gym: membership.gym, type: 'income', amount,
        description: `Membership: ${member?.name || 'Member'}`,
        source: 'membership', payment: payment._id, createdBy: req.user.id,
      });
      // Notify owner + staff (skip whoever recorded the payment) with the member's photo
      announcePayment(membership.gym, gym?.name, { id: membership.user, name: member?.name, phone: member?.phone, avatar: member?.avatar }, amount, finalPlan, req.user.id);
    }

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
      const [gym, nu] = await Promise.all([
        Gym.findById(gymId).select('name'),
        User.findById(userId).select('name phone avatar'),
      ]);
      announceNewMember(gymId, gym?.name, { id: userId, name: nu?.name, phone: nu?.phone, avatar: nu?.avatar }, req.user.id);
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

// ===================== CASHBOOK =====================

// @desc  Add income/expense entry
exports.addCashEntry = async (req, res, next) => {
  try {
    const { gymId, type, amount, description, date } = req.body;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    if (!['income', 'expense'].includes(type) || !amount) return res.status(400).json({ success: false, message: 'type and amount required' });
    const entry = await GymCashbook.create({ gym: gymId, type, amount, description, date: date || new Date(), createdBy: req.user.id });
    res.status(201).json({ success: true, data: entry });
  } catch (e) { next(e); }
};

// @desc  Cashbook for a month (entries + summary)
exports.getCashbook = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const { month } = req.query; // 'YYYY-MM'
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    let start, end;
    if (month) {
      start = new Date(`${month}-01T00:00:00`);
      end = new Date(start); end.setMonth(end.getMonth() + 1);
    } else {
      start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      end = new Date(start); end.setMonth(end.getMonth() + 1);
    }
    const entries = await GymCashbook.find({ gym: gymId, date: { $gte: start, $lt: end } }).sort({ date: -1 });
    const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    res.json({ success: true, data: { entries, income, expense, balance: income - expense } });
  } catch (e) { next(e); }
};

// @desc  Delete a cashbook entry
exports.deleteCashEntry = async (req, res, next) => {
  try {
    const entry = await GymCashbook.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    if (!(await ownsGym(req.user, entry.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });
    await entry.deleteOne();
    res.json({ success: true });
  } catch (e) { next(e); }
};

// @desc  Monthly report data — all members with attendance + payment for the month
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const { month } = req.query;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    let start, end, label;
    if (month) { start = new Date(`${month}-01T00:00:00`); }
    else { start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); }
    end = new Date(start); end.setMonth(end.getMonth() + 1);
    label = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const gym = await Gym.findById(gymId);
    const memberships = await Membership.find({ gym: gymId }).populate('user', 'name phone');

    const rows = await Promise.all(memberships.map(async (m) => {
      const present = await GymAttendance.countDocuments({ gym: gymId, user: m.user._id, checkInAt: { $gte: start, $lt: end } });
      const paidAgg = await GymPayment.find({ gym: gymId, user: m.user._id, paidDate: { $gte: start, $lt: end } });
      const paid = paidAgg.reduce((s, p) => s + p.amount, 0);
      return {
        name: m.user?.name || 'Member',
        phone: m.user?.phone || '',
        plan: m.plan,
        fee: m.fee,
        present,
        paid,
        isDue: m.dueDate ? new Date(m.dueDate) < new Date() : false,
        dueDate: m.dueDate,
      };
    }));

    const totals = {
      members: rows.length,
      totalPresent: rows.reduce((s, r) => s + r.present, 0),
      totalCollected: rows.reduce((s, r) => s + r.paid, 0),
      totalDue: rows.filter(r => r.isDue).length,
    };
    res.json({ success: true, data: { gym: { name: gym?.name, location: gym?.location }, month: label, rows, totals } });
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
      announceNewMember(gym._id, gym.name, { id: req.user.id, name: req.user.name, phone: req.user.phone, avatar: req.user.avatar }, req.user.id);
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

// ===================== PUBLIC (no app needed) =====================

const PAGE_SHELL = (body, gymCode) => `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>FitAI Gym Check-in</title>
<link rel="manifest" href="${gymCode ? `/g/${String(gymCode).replace(/[^A-Za-z0-9]/g, '')}/manifest.json` : '/gym-manifest.json'}"/>
<meta name="theme-color" content="#6C63FF"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-title" content="FitAI Gym"/>
<style>*{box-sizing:border-box;font-family:-apple-system,Roboto,sans-serif}body{margin:0;background:#151725;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#222438;border:1px solid #363a5c;border-radius:20px;padding:28px;max-width:380px;width:100%}
h1{margin:0 0 4px;font-size:22px}.sub{color:#9092b0;margin:0 0 22px;font-size:14px}
label{font-size:12px;color:#c2c3da;display:block;margin:14px 0 6px}
input{width:100%;padding:14px;border-radius:12px;border:1px solid #363a5c;background:#151725;color:#fff;font-size:16px}
button{width:100%;margin-top:22px;padding:15px;border:0;border-radius:12px;background:#6C63FF;color:#fff;font-size:16px;font-weight:700}
a.btn{display:block;text-align:center;text-decoration:none;margin-top:18px;padding:13px;border-radius:12px;background:#6C63FF;color:#fff;font-weight:700}
.ok{text-align:center}.ok .big{font-size:52px}.muted{color:#9092b0;font-size:13px;line-height:1.5}
#installBtn{display:none;margin-top:14px;background:#222438;border:1px solid #6C63FF;color:#8B85FF}</style></head><body>
<div class="card">${body}
<button id="installBtn" type="button">📲 Install this as an app</button>
</div>
<script src="/gym-app.js"></script></body></html>`;

const esc = (s) => String(s || '').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
const getCookie = (req, name) => {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
};

const okPage = (name, gymName, sub, gymCode, extra = '') =>
  PAGE_SHELL(`<div class="ok"><div class="big">✅</div><h1>Welcome ${esc(name)}!</h1><p class="muted">${esc(gymName)}<br/>${sub}</p></div>${extra}`, gymCode);

// Build a small "my recent attendance" block (this-month count + recent check-ins)
async function attendanceHtml(gym, user) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [list, monthCount] = await Promise.all([
    GymAttendance.find({ gym: gym._id, user: user._id }).sort({ checkInAt: -1 }).limit(20),
    GymAttendance.countDocuments({ gym: gym._id, user: user._id, checkInAt: { $gte: monthStart } }),
  ]);
  if (!list.length) return '';
  const rows = list.map(a => {
    const d = new Date(a.checkInAt);
    return `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #2c2f4a">
      <span style="color:#fff;font-size:13px">✅ ${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <span style="color:#9092b0;font-size:12px">${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>`;
  }).join('');
  return `<div style="margin-top:22px;text-align:left">
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <div style="flex:1;background:#151725;border:1px solid #363a5c;border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#8B85FF">${monthCount}</div><div style="font-size:11px;color:#9092b0">this month</div></div>
      <div style="flex:1;background:#151725;border:1px solid #363a5c;border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:#8B85FF">${list.length}</div><div style="font-size:11px;color:#9092b0">recent check-ins</div></div>
    </div>
    <div style="font-size:12px;color:#c2c3da;margin-bottom:2px">📅 My attendance</div>
    ${rows}
  </div>`;
}

// @desc  Per-gym PWA manifest — start_url opens the gym's check-in page (not the API root)
exports.gymManifest = (req, res) => {
  const code = String(req.params.gymCode || '').replace(/[^A-Za-z0-9]/g, '');
  res.json({
    name: 'FitAI Gym Check-in',
    short_name: 'Gym Check-in',
    description: 'Check in & view your gym attendance',
    start_url: `/g/${code}`,
    scope: '/',
    display: 'standalone',
    background_color: '#151725',
    theme_color: '#6C63FF',
    icons: [
      { src: '/gym-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/gym-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  });
};

// Existing user → ensure membership (trial) + mark today's attendance
async function attendUser(gym, user) {
  let membership = await Membership.findOne({ user: user._id, gym: gym._id });
  if (!membership) {
    membership = await Membership.create({ user: user._id, gym: gym._id, plan: 'trial', fee: 0, joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active' });
    announceNewMember(gym._id, gym.name, { id: user._id, name: user.name, phone: user.phone, avatar: user.avatar }); // public join → notify whole team
  }
  const day = istDay();
  try {
    await GymAttendance.create({ user: user._id, gym: gym._id, membership: membership._id, day, method: 'self_scan' });
    return { duplicate: false };
  } catch (e) {
    if (e.code === 11000) return { duplicate: true };
    throw e;
  }
}

// @desc  STEP 1 — phone-only page. Registered members just enter their number;
//        new people are asked for a name on step 2. No cookie needed (works on iPhone).
exports.gymPublicPage = async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymCode: req.params.gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1><p class="muted">This gym QR is not valid.</p></div>`));

    // If the device remembers a phone (cache) AND that person exists → check in
    // DIRECTLY (no tap). If cache missing/cleared → fall back to entering number.
    const savedPhone = getCookie(req, 'gphone');
    if (savedPhone && req.query.new !== '1') {
      const user = await User.findOne({ phone: savedPhone });
      if (user) {
        const r = await attendUser(gym, user);
        const hist = await attendanceHtml(gym, user);
        return res.send(PAGE_SHELL(`
          <div class="ok"><div class="big">✅</div>
            <h1>Welcome ${esc(user.name)}!</h1>
            <p class="muted">${esc(gym.name)}<br/>${r.duplicate ? 'Already checked in today.' : 'Attendance marked. Have a great workout! 💪'}</p>
          </div>
          ${hist}
          <a class="btn" style="background:#222438;border:1px solid #363a5c" href="/g/${gym.gymCode}?new=1">Not you? Enter a different number</a>`, gym.gymCode));
      }
    }

    // No cache → phone-first form
    res.send(PAGE_SHELL(`
      <h1>🏋️ ${esc(gym.name)}</h1>
      <p class="sub">${esc(gym.location || '')} — Enter your number to check in</p>
      <form method="POST" action="/g/${gym.gymCode}/submit">
        <label>Mobile Number</label>
        <input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number" required autofocus/>
        <button type="submit">Continue</button>
      </form>
      <p class="muted" style="text-align:center;margin-top:14px">Already a member? Just enter your number for instant check-in.<br/>New here? We'll ask your name on the next step.</p>`, gym.gymCode));
  } catch (e) { res.status(500).send('Error'); }
};

// @desc  STEP 2 — phone submitted. If registered → attendance done.
//        If new → show a small "your name" form to finish registration.
exports.gymPublicSubmit = async (req, res) => {
  try {
    const gymCode = req.params.gymCode;
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const gym = await Gym.findOne({ gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1></div>`));
    if (phone.length < 10) {
      return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⚠️</div><h1>Enter a valid 10-digit number</h1><a class="btn" href="/g/${esc(gymCode)}">Try again</a></div>`));
    }

    const user = await User.findOne({ phone });
    if (user) {
      // Registered already → just mark attendance (no name/email asked)
      const r = await attendUser(gym, user);
      const hist = await attendanceHtml(gym, user);
      res.setHeader('Set-Cookie', `gphone=${encodeURIComponent(phone)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`);
      return res.send(okPage(user.name, gym.name, r.duplicate ? 'You were already checked in today.' : 'Attendance marked. Have a great workout! 💪', gym.gymCode, hist));
    }

    // New person → ask for name + photo (email optional), phone carried hidden
    res.send(PAGE_SHELL(`
      <h1>🏋️ ${esc(gym.name)}</h1>
      <p class="sub">New here? Add your photo & name to finish checking in.</p>
      <form method="POST" action="/g/${gym.gymCode}/register" id="regForm">
        <input type="hidden" name="phone" value="${esc(phone)}"/>
        <input type="hidden" name="avatar" id="avatar"/>
        <label>Your Photo <span style="color:#9092b0">(optional)</span></label>
        <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
          <img id="preview" alt="" style="width:64px;height:64px;border-radius:32px;object-fit:cover;background:#151725;border:1px solid #363a5c;display:none"/>
          <label for="photo" style="flex:1;margin:0;text-align:center;padding:13px;border-radius:12px;background:#222438;border:1px solid #6C63FF;color:#8B85FF;font-weight:700">📷 Add Photo</label>
        </div>
        <input type="file" id="photo" accept="image/*" capture="user" style="display:none"/>
        <label>Your Name</label>
        <input name="name" placeholder="e.g. Ramesh" required/>
        <label>Email <span style="color:#9092b0">(optional)</span></label>
        <input name="email" type="email" placeholder="you@email.com"/>
        <button type="submit">Register & Check In</button>
      </form>
      <script>
      (function(){
        var inp=document.getElementById('photo'),av=document.getElementById('avatar'),pv=document.getElementById('preview');
        inp.addEventListener('change',function(){
          var f=inp.files&&inp.files[0];if(!f)return;
          var r=new FileReader();
          r.onload=function(e){
            var img=new Image();
            img.onload=function(){
              var max=400,scale=Math.min(max/img.width,max/img.height,1),c=document.createElement('canvas');
              c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
              c.getContext('2d').drawImage(img,0,0,c.width,c.height);
              var data=c.toDataURL('image/jpeg',0.5);
              av.value=data;pv.src=data;pv.style.display='block';
            };
            img.src=e.target.result;
          };
          r.readAsDataURL(f);
        });
      })();
      </script>`, gym.gymCode));
  } catch (e) { res.status(500).send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Failed</h1><p class="muted">Please try again.</p></div>`)); }
};

// @desc  STEP 3 — new person submits name → create user + membership + attendance
exports.gymPublicRegister = async (req, res) => {
  try {
    const gymCode = req.params.gymCode;
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const name = (req.body.name || '').trim() || 'Member';
    const email = req.body.email;
    const gym = await Gym.findOne({ gymCode });
    if (!gym || phone.length < 10) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⚠️</div><h1>Something went wrong</h1><a class="btn" href="/g/${esc(gymCode)}">Start again</a></div>`));

    const cleanEmail = email && /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase().trim() : null;
    const avatar = (typeof req.body.avatar === 'string' && req.body.avatar.startsWith('data:image/')) ? req.body.avatar : '';
    let user = await User.findOne({ phone }); // double-check (race)
    if (!user) {
      user = await User.create({ name, phone, email: cleanEmail || `g_${phone}_${Date.now()}@fitai.local`, role: 'user', avatar });
    } else if (avatar && !user.avatar) {
      try { user.avatar = avatar; await user.save(); } catch (e) {}
    }
    const r = await attendUser(gym, user);
    const hist = await attendanceHtml(gym, user);
    res.setHeader('Set-Cookie', `gphone=${encodeURIComponent(phone)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`);
    res.send(okPage(user.name, gym.name, r.duplicate ? 'Already checked in today.' : 'Registered & attendance marked! Pay your fee at the counter.', gym.gymCode, hist));
  } catch (e) { res.status(500).send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Failed</h1><p class="muted">Please try again.</p></div>`)); }
};

// @desc  Public JSON check-in (used by the app scanner) — no auth
exports.webCheckIn = async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    if (phone.length < 10) return res.status(400).json({ success: false, message: 'Valid phone required' });
    const gym = await Gym.findOne({ gymCode: req.body.gymCode });
    if (!gym) return res.status(400).json({ success: false, message: 'Invalid gym QR' });
    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ name: req.body.name || 'Member', phone, email: `g_${phone}_${Date.now()}@fitai.local`, role: 'user' });
    const r = await attendUser(gym, user);
    res.json({ success: true, message: `Welcome ${user.name}!`, gym: gym.name, duplicate: r.duplicate });
  } catch (e) { next(e); }
};

module.exports = exports;
