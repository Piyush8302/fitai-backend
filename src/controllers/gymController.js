const Gym = require('../models/Gym');
const Membership = require('../models/Membership');
const GymAttendance = require('../models/GymAttendance');
const GymPayment = require('../models/GymPayment');
const GymCashbook = require('../models/GymCashbook');
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
      GymAttendance.find({ gym: membership.gym, user: membership.user._id }).sort({ checkInAt: -1 }).limit(60),
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

    membership.lastPaidDate = new Date();
    membership.dueDate = addMonths(new Date(), months);
    membership.status = 'active';
    if (plan) membership.plan = plan;
    if (amount) membership.fee = amount;
    await membership.save();

    // Auto-add this payment to the cashbook as income (so owner doesn't re-enter)
    if (amount > 0) {
      const member = await User.findById(membership.user).select('name');
      await GymCashbook.create({
        gym: membership.gym, type: 'income', amount,
        description: `Membership: ${member?.name || 'Member'}`,
        source: 'membership', payment: payment._id, createdBy: req.user.id,
      });
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

const PAGE_SHELL = (body) => `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Gym Check-in</title>
<style>*{box-sizing:border-box;font-family:-apple-system,Roboto,sans-serif}body{margin:0;background:#151725;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#222438;border:1px solid #363a5c;border-radius:20px;padding:28px;max-width:380px;width:100%}
h1{margin:0 0 4px;font-size:22px}.sub{color:#9092b0;margin:0 0 22px;font-size:14px}
label{font-size:12px;color:#c2c3da;display:block;margin:14px 0 6px}
input{width:100%;padding:14px;border-radius:12px;border:1px solid #363a5c;background:#151725;color:#fff;font-size:16px}
button{width:100%;margin-top:22px;padding:15px;border:0;border-radius:12px;background:#6C63FF;color:#fff;font-size:16px;font-weight:700}
a.btn{display:block;text-align:center;text-decoration:none;margin-top:18px;padding:13px;border-radius:12px;background:#6C63FF;color:#fff;font-weight:700}
.ok{text-align:center}.ok .big{font-size:52px}.muted{color:#9092b0;font-size:13px;line-height:1.5}</style></head><body><div class="card">${body}</div></body></html>`;

const esc = (s) => String(s || '').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));

// @desc  Serve registration/check-in page (uses a NATIVE form POST — no inline JS, CSP-safe)
exports.gymPublicPage = async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymCode: req.params.gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1><p class="muted">This gym QR is not valid.</p></div>`));
    res.send(PAGE_SHELL(`
      <h1>🏋️ ${esc(gym.name)}</h1>
      <p class="sub">${esc(gym.location || '')} — Register & check in</p>
      <form method="POST" action="/g/${gym.gymCode}/submit">
        <label>Your Name</label>
        <input name="name" placeholder="e.g. Ramesh" required/>
        <label>Mobile Number</label>
        <input name="phone" type="tel" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number" required/>
        <label>Email <span style="color:#9092b0">(optional)</span></label>
        <input name="email" type="email" placeholder="you@email.com"/>
        <button type="submit">Register & Check-in</button>
      </form>`));
  } catch (e) { res.status(500).send('Error'); }
};

// Shared core: register-by-phone + mark attendance. Returns a result object.
async function doWebCheckIn(gymCode, name, phone, email) {
  if (!phone || String(phone).replace(/\D/g, '').length < 10) return { error: 'Valid 10-digit phone required' };
  const gym = await Gym.findOne({ gymCode });
  if (!gym) return { error: 'Invalid gym QR' };

  const cleanEmail = email && /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase().trim() : null;
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ name: name || 'Member', phone, email: cleanEmail || `g_${phone}_${Date.now()}@fitai.local`, role: 'user' });
  } else if (cleanEmail && (!user.email || user.email.endsWith('@fitai.local'))) {
    // fill a real email if we only had a placeholder
    try { user.email = cleanEmail; await user.save(); } catch (e) { /* email taken, skip */ }
  }
  let membership = await Membership.findOne({ user: user._id, gym: gym._id });
  const isNew = !membership;
  if (!membership) {
    membership = await Membership.create({ user: user._id, gym: gym._id, plan: 'trial', fee: 0, joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active' });
  }
  const day = istDay();
  try {
    await GymAttendance.create({ user: user._id, gym: gym._id, membership: membership._id, day, method: 'self_scan' });
    return { ok: true, name: user.name, gym: gym.name, isNew, duplicate: false };
  } catch (dupErr) {
    if (dupErr.code === 11000) return { ok: true, name: user.name, gym: gym.name, isNew: false, duplicate: true };
    throw dupErr;
  }
}

// @desc  Handle the native form POST → returns an HTML result page (CSP-safe, no JS)
exports.gymPublicSubmit = async (req, res) => {
  try {
    const r = await doWebCheckIn(req.params.gymCode, req.body.name, req.body.phone, req.body.email);
    if (r.error) {
      return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⚠️</div><h1>${esc(r.error)}</h1><a class="btn" href="/g/${esc(req.params.gymCode)}">Try again</a></div>`));
    }
    const sub = r.duplicate ? 'You were already checked in today.' : r.isNew ? 'Registered & attendance marked! Pay your fee at the counter.' : 'Attendance marked. Have a great workout!';
    res.send(PAGE_SHELL(`<div class="ok"><div class="big">✅</div><h1>Welcome ${esc(r.name)}!</h1><p class="muted">${esc(r.gym)}<br/>${sub}</p></div>`));
  } catch (e) { res.status(500).send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Failed</h1><p class="muted">Please try again.</p></div>`)); }
};

// @desc  Public JSON check-in (used by the app scanner) — no auth
exports.webCheckIn = async (req, res, next) => {
  try {
    const r = await doWebCheckIn(req.body.gymCode, req.body.name, req.body.phone);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, message: `Welcome ${r.name}!`, gym: r.gym, duplicate: r.duplicate });
  } catch (e) { next(e); }
};

module.exports = exports;
