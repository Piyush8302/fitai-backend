const crypto = require('crypto');
const QRCode = require('qrcode');
const Gym = require('../models/Gym');
const Membership = require('../models/Membership');
const GymAttendance = require('../models/GymAttendance');
const GymPayment = require('../models/GymPayment');
const GymCashbook = require('../models/GymCashbook');
const StaffAttendance = require('../models/StaffAttendance');
const User = require('../models/User');
const { notifyUsers } = require('../utils/push');
const { uploadAvatar } = require('../utils/cloudinary');

// ---- helpers ----
const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().split('T')[0];

// Current time in IST as minutes-since-midnight
const istMinutes = () => { const d = new Date(Date.now() + 5.5 * 3600 * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hhmmToMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
// Is `now` (IST minutes) inside an open–close window? Supports overnight (22:00–06:00).
const inWindow = (o, c) => { const now = istMinutes(); return o < c ? (now >= o && now <= c) : (now >= o || now <= c); };
// Collect valid [open,close] windows from the gym's slots (or legacy single window).
const gymWindows = (gym) => {
  const out = [];
  (Array.isArray(gym?.slots) ? gym.slots : []).forEach((s) => {
    const o = hhmmToMin(s.open), c = hhmmToMin(s.close);
    if (o != null && c != null && o !== c) out.push([o, c]);
  });
  if (!out.length) {
    const o = hhmmToMin(gym?.openTime), c = hhmmToMin(gym?.closeTime);
    if (o != null && c != null && o !== c) out.push([o, c]);
  }
  return out;
};
// Open now if no windows defined (24×7) or the current time is inside ANY window.
const gymOpenNow = (gym) => {
  const w = gymWindows(gym);
  return w.length === 0 || w.some(([o, c]) => inWindow(o, c));
};

// A blocked / deactivated / left member cannot mark attendance.
const NO_CHECKIN_STATUSES = ['blocked', 'inactive', 'left'];
const memberBlockedMsg = (m) =>
  m?.status === 'blocked' ? 'This member is blocked and cannot check in.'
  : m?.status === 'inactive' ? 'This member is deactivated. Reactivate them to allow check-in.'
  : m?.status === 'left' ? 'This member has left the gym. Reactivate them to allow check-in.'
  : null;
// Human label like "06:00–10:00, 17:00–22:00" (empty = 24×7).
const gymHoursLabel = (gym) => {
  const slots = (Array.isArray(gym?.slots) ? gym.slots : []).filter((s) => s.open && s.close);
  if (slots.length) return slots.map((s) => `${s.open}–${s.close}`).join(', ');
  return (gym?.openTime && gym?.closeTime) ? `${gym.openTime}–${gym.closeTime}` : '';
};

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Clean an incoming slots array → [{open, close}]; throws a message if a time is bad.
const sanitizeSlots = (slots) => {
  const out = [];
  if (Array.isArray(slots)) {
    for (const s of slots) {
      if (!s || (!s.open && !s.close)) continue;
      if (!HHMM.test(s.open) || !HHMM.test(s.close)) throw new Error('Each slot time must be HH:MM (24-hour), e.g. 06:00');
      out.push({ open: s.open, close: s.close });
    }
  }
  return out;
};
// Clean owner-set plan prices → only known plan keys, non-negative numbers.
const sanitizePrices = (pp) => {
  const out = {};
  if (pp && typeof pp === 'object') {
    ['monthly', 'quarterly', 'half_yearly', 'yearly'].forEach((k) => {
      if (pp[k] !== undefined && pp[k] !== '') out[k] = Math.max(0, Math.round(Number(pp[k]) || 0));
    });
  }
  return out;
};

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
  // Push thumbnail: a Cloudinary URL is used directly; a base64 avatar is served
  // via /api/gym/avatar/:id (legacy). No photo → no thumbnail.
  const av = member.avatar ? String(member.avatar) : '';
  const imageUrl = av.startsWith('http') ? av
    : (av.startsWith('data:') && member.id ? `${PUBLIC_BASE_URL}/api/gym/avatar/${member.id}` : undefined);
  // membershipId + gymId let the app open the member's detail page on tap.
  return notifyGymTeam(gymId, {
    title: `🆕 New member at ${gymName || 'your gym'}`,
    body: `${member.name || 'A new member'}${member.phone ? ` (${member.phone})` : ''} just joined. 🎉`,
    type: 'success',
    data: {
      kind: 'new_member',
      screen: member.membershipId ? 'GymMemberDetail' : 'GymAdmin',
      gymId: String(gymId),
      membershipId: member.membershipId ? String(member.membershipId) : undefined,
      memberId: member.id ? String(member.id) : undefined,
      gym: gymName, memberName: member.name, avatar: member.avatar || undefined,
    },
    imageUrl,
    excludeUserId,
  });
};

// "Payment received" notification for a gym's team (with member's photo).
const announcePayment = (gymId, gymName, member = {}, amount, planLabel, excludeUserId) => {
  // Push thumbnail: a Cloudinary URL is used directly; a base64 avatar is served
  // via /api/gym/avatar/:id (legacy). No photo → no thumbnail.
  const av = member.avatar ? String(member.avatar) : '';
  const imageUrl = av.startsWith('http') ? av
    : (av.startsWith('data:') && member.id ? `${PUBLIC_BASE_URL}/api/gym/avatar/${member.id}` : undefined);
  return notifyGymTeam(gymId, {
    title: `💵 Payment received — ${gymName || 'your gym'}`,
    body: `${member.name || 'A member'} paid ₹${amount}${planLabel ? ` (${planLabel})` : ''}. ✅`,
    type: 'success',
    data: { kind: 'payment', gym: gymName, memberName: member.name, avatar: member.avatar || undefined, amount },
    imageUrl,
    excludeUserId,
  });
};

// "Member checked in" notification for the gym team (once per member per day).
const announceCheckin = (gymId, gymName, member = {}, method, excludeUserId) => {
  const av = member.avatar ? String(member.avatar) : '';
  const imageUrl = av.startsWith('http') ? av
    : (av.startsWith('data:') && member.id ? `${PUBLIC_BASE_URL}/api/gym/avatar/${member.id}` : undefined);
  const via = method === 'staff_scan' ? ' (staff scan)' : method === 'auto_geo' ? ' (auto — entered the gym)' : '';
  return notifyGymTeam(gymId, {
    title: `✅ Check-in — ${gymName || 'your gym'}`,
    body: `${member.name || 'A member'} just checked in${via}.`,
    type: 'info',
    data: { kind: 'checkin', screen: 'GymMemberDetail', gymId: String(gymId), membershipId: member.membershipId ? String(member.membershipId) : undefined, memberId: member.id ? String(member.id) : undefined, memberName: member.name, avatar: member.avatar || undefined },
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

// Action rights: owner/admin can do everything; a gym_staff needs the specific
// permission granted by the owner — and must be an active staff account.
const staffCan = (user, flag) => {
  if (user.role !== 'gym_staff') return true;
  if (user.staffStatus && user.staffStatus !== 'active') return false; // blocked/inactive/left
  return !!user[flag];
};
const denyStaff = (res, action) => res.status(403).json({ success: false, message: `You don't have permission to ${action}. Ask the gym owner.` });

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
    const { name, location, city, phone, lat, lng, ownerPhone, slots, openTime, closeTime, planPrices } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gym name required' });
    const okTime = (t) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t);
    // Build clean open–close slots (skip blanks). Empty = 24×7.
    const cleanSlots = [];
    if (Array.isArray(slots)) {
      for (const s of slots) {
        if (!s || (!s.open && !s.close)) continue;
        if (!okTime(s.open) || !okTime(s.close)) return res.status(400).json({ success: false, message: 'Each slot time must be HH:MM (24-hour), e.g. 06:00' });
        cleanSlots.push({ open: s.open, close: s.close });
      }
    }
    if ((openTime && !okTime(openTime)) || (closeTime && !okTime(closeTime))) return res.status(400).json({ success: false, message: 'Time must be HH:MM (24-hour)' });

    // Only an APPROVED gym owner (or super admin) can create gyms — no direct
    // self-promotion. New owners must register and be approved in the admin panel.
    if (!['gym_owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Please register as a gym owner and get approved first.' });
    }

    // A gym owner must have a mobile number on file. If they don't have one yet
    // (e.g. signed up with email), require it while creating the gym.
    if (!req.user.phone) {
      const op = String(ownerPhone || '').replace(/\D/g, '');
      if (op.length < 10) return res.status(400).json({ success: false, message: 'Owner mobile number is required' });
      const taken = await User.findOne({ phone: op, _id: { $ne: req.user.id } });
      if (taken) return res.status(400).json({ success: false, message: 'This mobile number is already in use' });
      await User.findByIdAndUpdate(req.user.id, { phone: op });
    }

    const gym = await Gym.create({ name, owner: req.user.id, location, city, phone, lat, lng, slots: cleanSlots, openTime: openTime || '', closeTime: closeTime || '', planPrices: sanitizePrices(planPrices) });
    res.status(201).json({ success: true, data: gym });
  } catch (e) { next(e); }
};

// @desc  Edit a gym — owner only. Update name, location, hours (slots) & plan prices.
exports.updateGym = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    if (!staffCan(req.user, 'canEditGym')) return denyStaff(res, 'edit the gym');
    const gym = await Gym.findById(gymId);
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });

    // Build a $set update — replacing the slots array via $set is the reliable way
    // to persist a full multi-slot array (avoids subdocument-array save quirks that
    // could drop all-but-one slot).
    const { name, location, city, phone, slots, planPrices } = req.body;
    const update = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ success: false, message: 'Gym name cannot be empty' });
      update.name = String(name).trim();
    }
    if (location !== undefined) update.location = String(location).trim();
    if (city !== undefined) update.city = String(city).trim();
    if (phone !== undefined) update.phone = String(phone).trim();
    if (slots !== undefined) {
      try { update.slots = sanitizeSlots(slots); }
      catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    }
    if (planPrices !== undefined) {
      const clean = sanitizePrices(planPrices);
      Object.keys(clean).forEach((k) => { update[`planPrices.${k}`] = clean[k]; });
    }
    const updated = await Gym.findByIdAndUpdate(gymId, { $set: update }, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
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
    if (!staffCan(req.user, 'canAddMember')) return denyStaff(res, 'add members');

    // Cloudinary: base64 photo → URL (falls back to base64 if not configured).
    const avatarUrl = await uploadAvatar(avatar);
    // Find existing user by phone, else create a lightweight one
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        name: name || 'Member',
        phone,
        email: `g_${phone}_${Date.now()}@fitai.local`, // placeholder, unique
        role: 'user',
        // avatar: avatar || '', // OLD: base64 straight to DB
        avatar: avatarUrl || '',
      });
    } else if (avatar && !user.avatar) {
      // try { user.avatar = avatar; await user.save(); } catch (e) {} // OLD: base64
      try { user.avatar = avatarUrl; await user.save(); } catch (e) {}
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
    // Notify the whole gym team. Owner is ALWAYS notified (even if the owner added
    // the member); only skip a STAFF member who added it themselves (no self-ping).
    const gym = await Gym.findById(gymId).select('name');
    const excludeId = req.user.role === 'gym_staff' ? req.user.id : undefined;
    announceNewMember(gymId, gym?.name, { id: user._id, membershipId: membership._id, name: user.name, phone: user.phone, avatar: user.avatar }, excludeId);
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

    // Cloudinary: base64 photo → URL (falls back to base64 if not configured).
    const avatarUrl = await uploadAvatar(avatar);
    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({
        name: name || 'Staff', phone: cleanPhone,
        email: `s_${cleanPhone}_${Date.now()}@fitai.local`,
        role: 'gym_staff', staffGym: gymId, staffRole, staffSalary: salary,
        // staffJoinDate: new Date(), avatar: avatar || '', // OLD: base64
        staffJoinDate: new Date(), avatar: avatarUrl || '',
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
      // if (avatar && !user.avatar) user.avatar = avatar; // OLD: base64
      if (avatar && !user.avatar) user.avatar = avatarUrl;
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
      .select('name phone avatar staffRole staffSalary staffJoinDate staffStatus canAccessCashbook canAccessReports canAddMember canMarkPayment canMarkPresent canManageStatus canEditGym').sort({ createdAt: -1 });
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
        canAccessCashbook: !!s.canAccessCashbook,
        canAccessReports: !!s.canAccessReports,
        canAddMember: !!s.canAddMember,
        canMarkPayment: !!s.canMarkPayment,
        canMarkPresent: !!s.canMarkPresent,
        canManageStatus: !!s.canManageStatus,
        canEditGym: !!s.canEditGym,
        staffStatus: s.staffStatus || 'active',
        presentToday: !!todayRec, checkInAt: todayRec?.checkInAt || null, monthCount,
      };
    }));
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

// @desc  Edit a staff member's details (name, role, salary) and optionally reassign gym
exports.updateStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { name, staffRole, salary, gymId } = req.body;
    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'gym_staff') return res.status(404).json({ success: false, message: 'Staff not found' });
    if (!(await ownsGym(req.user, staff.staffGym))) return res.status(403).json({ success: false, message: 'Not your staff' });

    if (name !== undefined && name.trim()) staff.name = name.trim();
    if (staffRole !== undefined) staff.staffRole = staffRole;
    if (salary !== undefined) staff.staffSalary = salary === '' ? undefined : Number(salary);
    // Owner-grantable permissions
    const PERMS = ['canAccessCashbook', 'canAccessReports', 'canAddMember', 'canMarkPayment', 'canMarkPresent', 'canManageStatus', 'canEditGym'];
    PERMS.forEach((k) => { if (req.body[k] !== undefined) staff[k] = !!req.body[k]; });
    // Staff account status (active/inactive/blocked/left)
    if (req.body.staffStatus !== undefined) {
      if (!['active', 'inactive', 'blocked', 'left'].includes(req.body.staffStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid staff status' });
      }
      staff.staffStatus = req.body.staffStatus;
    }
    // Reassign to another gym the owner owns
    if (gymId && String(gymId) !== String(staff.staffGym)) {
      if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
      staff.staffGym = gymId;
    }
    await staff.save();
    const out = { _id: staff._id, name: staff.name, staffRole: staff.staffRole, staffSalary: staff.staffSalary, staffGym: staff.staffGym, staffStatus: staff.staffStatus };
    PERMS.forEach((k) => { out[k] = !!staff[k]; });
    res.json({ success: true, data: out });
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

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { gym: gymId };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    // Optional search by member name/phone (match users first, then filter memberships)
    const q = (req.query.search || '').trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const users = await User.find({ $or: [{ name: rx }, { phone: rx }] }).select('_id');
      filter.user = { $in: users.map(u => u._id) };
    }

    const [total, memberships] = await Promise.all([
      Membership.countDocuments(filter),
      Membership.find(filter).populate('user', 'name phone email avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

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
    res.json({ success: true, count: data.length, total, page, hasMore: skip + memberships.length < total, data });
  } catch (e) { next(e); }
};

// @desc  Owner sets a member's status: active | inactive | blocked | left
exports.setMemberStatus = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const { status } = req.body;
    const allowed = ['active', 'inactive', 'blocked', 'left'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const membership = await Membership.findById(membershipId);
    if (!membership) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!(await ownsGym(req.user, membership.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });
    if (!staffCan(req.user, 'canManageStatus')) return denyStaff(res, 'change member status');
    membership.status = status;
    await membership.save();

    // Notify the whole gym team (owner + all staff) about the status change.
    try {
      const [gym, u] = await Promise.all([
        Gym.findById(membership.gym).select('name'),
        User.findById(membership.user).select('name phone avatar'),
      ]);
      const LBL = { active: 'reactivated ✅', inactive: 'deactivated ⏸️', blocked: 'blocked 🚫', left: 'marked as left 🚪' };
      const label = LBL[status] || status;
      const av = u?.avatar ? String(u.avatar) : '';
      const imageUrl = av.startsWith('http') ? av
        : (av.startsWith('data:') ? `${PUBLIC_BASE_URL}/api/gym/avatar/${membership.user}` : undefined);
      notifyGymTeam(membership.gym, {
        title: `Member ${label} — ${gym?.name || 'your gym'}`,
        body: `${u?.name || 'A member'}${u?.phone ? ` (${u.phone})` : ''} was ${label}.`,
        type: status === 'blocked' ? 'warning' : status === 'active' ? 'success' : 'info',
        data: { kind: 'member_status', screen: 'GymMemberDetail', gymId: String(membership.gym), membershipId: String(membership._id), memberId: String(membership.user), memberName: u?.name, avatar: u?.avatar || undefined, status },
        imageUrl,
      });
    } catch (e) { console.log('status notify error:', e.message); }

    res.json({ success: true, message: `Member marked ${status}`, data: { _id: membership._id, status } });
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
    const { membershipId, amount, plan, periodMonths, dueDate } = req.body;
    const membership = await Membership.findById(membershipId);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found' });
    if (!(await ownsGym(req.user, membership.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });
    if (!staffCan(req.user, 'canMarkPayment')) return denyStaff(res, 'mark payments');

    const months = periodMonths || PLAN_MONTHS[plan || membership.plan] || 1;
    const payment = await GymPayment.create({
      user: membership.user, gym: membership.gym, membership: membership._id,
      amount, plan: plan || membership.plan, periodMonths: months, markedBy: req.user.id,
    });

    const finalPlan = plan || membership.plan;
    membership.lastPaidDate = new Date();
    // Owner can fix a custom due date; otherwise it's auto-calculated from the plan
    const customDue = dueDate ? new Date(dueDate) : null;
    membership.dueDate = (customDue && !isNaN(customDue)) ? customDue : addMonths(new Date(), months);
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

// @desc  Remove a member from the gym (delete the membership)
exports.deleteMember = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const membership = await Membership.findById(membershipId);
    if (!membership) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!(await ownsGym(req.user, membership.gym))) return res.status(403).json({ success: false, message: 'Not your gym' });
    // Grab details before deleting so we can notify the team.
    const [gym, u] = await Promise.all([
      Gym.findById(membership.gym).select('name'),
      User.findById(membership.user).select('name phone avatar'),
    ]);
    const gymId = membership.gym;
    await membership.deleteOne();
    // Notify owner + all staff that a member was removed (delete is owner-only).
    try {
      const av = u?.avatar ? String(u.avatar) : '';
      const imageUrl = av.startsWith('http') ? av : (av.startsWith('data:') ? `${PUBLIC_BASE_URL}/api/gym/avatar/${membership.user}` : undefined);
      notifyGymTeam(gymId, {
        title: `🗑️ Member removed — ${gym?.name || 'your gym'}`,
        body: `${u?.name || 'A member'}${u?.phone ? ` (${u.phone})` : ''} was removed from the gym.`,
        type: 'warning',
        data: { kind: 'member_removed', gym: gym?.name, memberName: u?.name, avatar: u?.avatar || undefined },
        imageUrl,
      });
    } catch (e) { console.log('delete notify error:', e.message); }
    res.json({ success: true, message: 'Member removed' });
  } catch (e) { next(e); }
};

// @desc  Mark attendance for a member (staff scans member QR → userId)
exports.markAttendance = async (req, res, next) => {
  try {
    const { gymId, userId } = req.body;
    if (!gymId || !userId) return res.status(400).json({ success: false, message: 'gymId and userId required' });
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    if (!staffCan(req.user, 'canMarkPresent')) return denyStaff(res, 'mark attendance');

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
      // Owner always notified; skip only a staff who scanned it themselves.
      const excludeId = req.user.role === 'gym_staff' ? req.user.id : undefined;
      announceNewMember(gymId, gym?.name, { id: userId, membershipId: membership._id, name: nu?.name, phone: nu?.phone, avatar: nu?.avatar }, excludeId);
    }

    const blk = memberBlockedMsg(membership);
    if (blk) return res.status(403).json({ success: false, message: blk });

    // Attendance only during gym hours (member already registered above).
    const gymFull = await Gym.findById(gymId).select('name slots openTime closeTime');
    if (!gymOpenNow(gymFull)) {
      const lbl = gymHoursLabel(gymFull);
      return res.status(403).json({ success: false, message: `${gymFull?.name || 'Gym'} is closed right now${lbl ? ` (open ${lbl})` : ''}. Attendance can be marked only during gym hours.` });
    }

    const day = istDay();
    try {
      const att = await GymAttendance.create({
        user: userId, gym: gymId, membership: membership._id,
        day, method: 'staff_scan', markedBy: req.user.id,
      });
      const u = await User.findById(userId).select('name phone avatar');
      // Notify the team (owner always; skip the staff who scanned it themselves).
      const excludeChk = req.user.role === 'gym_staff' ? req.user.id : undefined;
      const g2 = await Gym.findById(gymId).select('name');
      announceCheckin(gymId, g2?.name, { id: userId, membershipId: membership._id, name: u?.name, avatar: u?.avatar }, 'staff_scan', excludeChk);
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

// @desc  Fee-due dashboard: summary buckets + a filterable member list.
exports.getGymFees = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const memberships = await Membership.find({ gym: gymId, status: { $in: ['active', 'expired', 'frozen'] } })
      .populate('user', 'name phone avatar').sort({ dueDate: 1 });

    // IST-aware day math
    const istMidnight = (d) => { const x = new Date(new Date(d).getTime() + 5.5 * 3600 * 1000); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
    const today0 = istMidnight(new Date());
    const dayDiff = (due) => Math.round((istMidnight(due) - today0) / 86400000); // <0 overdue, 0 today, >0 future

    const members = memberships.map((m) => {
      const fee = m.fee || 0;
      let bucket = 'ok', diff = null;
      if (m.dueDate) {
        diff = dayDiff(m.dueDate);
        bucket = diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff <= 7 ? 'upcoming' : 'ok';
      }
      return {
        _id: m._id, user: m.user, plan: m.plan, fee,
        dueDate: m.dueDate, lastPaidDate: m.lastPaidDate, status: m.status,
        bucket, daysDiff: diff,
        pending: (bucket === 'overdue' || bucket === 'today') ? fee : 0,
      };
    });

    const by = (b) => members.filter((m) => m.bucket === b);
    const overdue = by('overdue'), today = by('today'), upcoming = by('upcoming');
    const due = [...overdue, ...today];
    const sumPending = (arr) => arr.reduce((s, m) => s + (m.fee || 0), 0);

    const summary = {
      activeMembers: members.length,
      dueMembers: due.length,
      dueToday: today.length,
      upcoming: upcoming.length,
      overdue: overdue.length,
      totalPending: sumPending(due),
      dueTodayAmount: sumPending(today),
      overdueAmount: sumPending(overdue),
      upcomingAmount: sumPending(upcoming),
    };
    res.json({ success: true, summary, data: members });
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
    const { month, months } = req.query;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });

    const span = Math.max(1, Math.min(12, parseInt(months) || 1)); // 1..12 months
    let start, end, label;
    // anchor = latest month in the range
    let anchor;
    if (month) { anchor = new Date(`${month}-01T00:00:00`); }
    else { anchor = new Date(); anchor.setDate(1); anchor.setHours(0, 0, 0, 0); }
    end = new Date(anchor); end.setMonth(end.getMonth() + 1);          // end of anchor month
    start = new Date(anchor); start.setMonth(start.getMonth() - (span - 1)); // span months back
    if (span > 1) {
      label = `${start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} – ${anchor.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`;
    } else {
      label = anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    }

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
        joinDate: m.joinDate,          // date of joining
        lastPaidDate: m.lastPaidDate,  // date of last payment
        status: m.status || 'active',  // active / inactive / blocked / left
      };
    }));

    const totals = {
      members: rows.length,
      totalPresent: rows.reduce((s, r) => s + r.present, 0),
      totalCollected: rows.reduce((s, r) => s + r.paid, 0),
      totalDue: rows.filter(r => r.isDue).length,
      pendingAmount: rows.filter(r => r.isDue).reduce((s, r) => s + (r.fee || 0), 0),
    };
    res.json({ success: true, data: { gym: { name: gym?.name, location: gym?.location }, month: label, rows, totals } });
  } catch (e) { next(e); }
};

// ===================== MEMBER (the gym-goer) =====================

// @desc  My membership card data + all my gyms
exports.getMyCard = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.user.id })
      .populate('gym', 'name location city lat lng')
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
    let { gymCode, token } = req.body;
    // Live encrypted QR token (preferred) → decrypt + enforce ~4-min expiry
    if (token) {
      const t = readCheckinToken(token);
      if (t.expired) return res.status(400).json({ success: false, message: 'QR expired — scan the live counter QR again' });
      if (t.invalid || !t.gymCode) return res.status(400).json({ success: false, message: 'Invalid gym QR' });
      gymCode = t.gymCode;
    }
    const gym = await Gym.findOne({ gymCode });
    if (!gym) return res.status(404).json({ success: false, message: 'Invalid gym QR' });

    // Open model: auto-create membership if none
    let membership = await Membership.findOne({ user: req.user.id, gym: gym._id });
    let isNew = false;
    if (!membership) {
      isNew = true;
      membership = await Membership.create({
        user: req.user.id, gym: gym._id, plan: 'trial', fee: 0,
        joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active',
      });
      announceNewMember(gym._id, gym.name, { id: req.user.id, membershipId: membership._id, name: req.user.name, phone: req.user.phone, avatar: req.user.avatar }, req.user.id);
    }
    const blk = memberBlockedMsg(membership);
    if (blk) return res.status(403).json({ success: false, message: blk });
    // Attendance only during gym hours; registration above is allowed any time.
    if (!gymOpenNow(gym)) {
      const lbl = gymHoursLabel(gym);
      const msg = isNew
        ? `You're registered! ${gym.name} is closed right now${lbl ? ` (open ${lbl})` : ''}. Attendance is marked only during gym hours.`
        : `${gym.name} is closed right now${lbl ? ` (open ${lbl})` : ''}. Attendance can be marked only during gym hours.`;
      return res.json({ success: true, data: { gym: gym.name, closed: true }, message: msg });
    }
    const day = istDay();
    try {
      await GymAttendance.create({
        user: req.user.id, gym: gym._id, membership: membership._id, day, method: 'self_scan',
      });
      // Member self-scanned → notify the whole team (owner + staff).
      announceCheckin(gym._id, gym.name, { id: req.user.id, membershipId: membership._id, name: req.user.name, avatar: req.user.avatar }, 'self_scan', req.user.id);
      return res.status(201).json({ success: true, message: `Checked in at ${gym.name}`, data: { gym: gym.name } });
    } catch (dupErr) {
      if (dupErr.code === 11000) return res.json({ success: true, message: `Already checked in at ${gym.name} today`, data: { gym: gym.name, duplicate: true } });
      throw dupErr;
    }
  } catch (e) { next(e); }
};

// @desc  Automatic check-in fired by the phone's geofence when a MEMBER enters
//        the gym's 100m radius (no app open needed). Existing members only —
//        never auto-registers; respects status, gym hours and the geofence.
exports.autoCheckIn = async (req, res, next) => {
  try {
    const { gymId, lat, lng } = req.body;
    if (!gymId) return res.status(400).json({ success: false, message: 'gymId required' });
    const gym = await Gym.findById(gymId);
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });

    const membership = await Membership.findOne({ user: req.user.id, gym: gym._id });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this gym' });
    const blk = memberBlockedMsg(membership);
    if (blk) return res.status(403).json({ success: false, message: blk });
    if (!gymOpenNow(gym)) return res.json({ success: true, data: { closed: true }, message: 'Gym is closed — attendance only during gym hours.' });

    // Server-side distance double-check with the coords the phone reported.
    const geo = checkGeofence(gym, lat, lng);
    if (!geo.ok) {
      return res.status(403).json({ success: false, message: geo.noCoords ? 'Location required for auto check-in' : `Too far (${geo.distance}m) — auto check-in works within ${GEOFENCE_RADIUS_M}m of the gym.` });
    }

    const day = istDay();
    try {
      await GymAttendance.create({ user: req.user.id, gym: gym._id, membership: membership._id, day, method: 'auto_geo' });
      announceCheckin(gym._id, gym.name, { id: req.user.id, membershipId: membership._id, name: req.user.name, avatar: req.user.avatar }, 'auto_geo', req.user.id);
      return res.status(201).json({ success: true, message: `Auto checked in at ${gym.name}`, data: { gym: gym.name } });
    } catch (dupErr) {
      if (dupErr.code === 11000) return res.json({ success: true, message: 'Already checked in today', data: { duplicate: true } });
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
#installBtn{display:none;margin-top:14px;background:#222438;border:1px solid #6C63FF;color:#8B85FF}
#iosBtn{display:none;margin-top:14px;background:#6C63FF;color:#fff}
#iosSheet{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:50}
#iosSheet .box{position:absolute;left:16px;right:16px;bottom:104px;background:#222438;border:1px solid #6C63FF;border-radius:18px;padding:22px}
#iosSheet h3{margin:0 0 12px;font-size:17px;color:#fff}
#iosSheet ol{margin:0;padding-left:20px;color:#c2c3da;font-size:14px;line-height:1.9}
#iosSheet b{color:#8B85FF}
#iosSheet .done{margin-top:16px;background:#6C63FF;color:#fff}
#iosTip{position:absolute;bottom:62px;left:0;right:0;text-align:center;color:#fff;font-size:14px;font-weight:700;text-shadow:0 1px 4px #000}
#iosArrow{position:absolute;bottom:12px;left:50%;font-size:42px;animation:iosbounce 1s infinite}
@keyframes iosbounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(9px)}}</style></head><body>
<div class="card">${body}
<button id="installBtn" type="button">📲 Install this as an app</button>
<button id="iosBtn" type="button">📲 Install App</button>
</div>
<div id="iosSheet">
  <div id="iosTip">Tap <b>Share</b> here</div>
  <div id="iosArrow">⬇️</div>
  <div class="box">
    <h3>📲 Add to Home Screen</h3>
    <ol>
      <li>Tap the <b>Share</b> button (⬆️) in Safari's bottom bar</li>
      <li>Scroll down &amp; tap <b>"Add to Home Screen"</b></li>
      <li>Tap <b>Add</b> — done! 🎉</li>
    </ol>
    <button class="done" type="button" onclick="document.getElementById('iosSheet').style.display='none'">Got it</button>
  </div>
</div>
<script src="/gym-app.js"></script></body></html>`;

const esc = (s) => String(s || '').replace(/[<>"'&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
const getCookie = (req, name) => {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
};

const okPage = (name, gymName, sub, gymCode, extra = '', icon = '✅', title = null) =>
  PAGE_SHELL(`<div class="ok"><div class="big">${icon}</div><h1>${title || `Welcome ${esc(name)}!`}</h1><p class="muted">${esc(gymName)}<br/>${sub}</p></div>${extra}`, gymCode);

// Result page for a check-in attempt: a clear CROSS + "Attendance not marked"
// when it didn't count (outside gym hours / blocked), so users don't have to
// read the message to know — the tick only shows when attendance was marked.
const attendPage = (gym, r, user, okMsg, hist = '') => {
  const icon = (r.blocked || r.closed) ? '❌' : '✅';
  const title = r.blocked ? 'Cannot check in'
    : r.closed ? 'Attendance NOT marked'
    : `Welcome ${esc(user.name)}!`;
  return okPage(user.name, gym.name, attendMsg(gym, r, okMsg), gym.gymCode, hist, icon, title);
};

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
      <span style="color:#fff;font-size:13px">✅ ${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</span>
      <span style="color:#9092b0;font-size:12px">${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
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

// ===== TIME-LIMITED ENCRYPTED CHECK-IN TOKEN =====
// The wall QR encodes an AES-encrypted token (gymCode + expiry). It is valid for
// ~4 minutes, so a saved link can't be reused later / from home.
const QR_KEY = crypto.createHash('sha256').update(process.env.QR_SECRET || process.env.JWT_SECRET || 'fitai-gym-qr-secret').digest();
const CHECKIN_TTL_MS = 4 * 60 * 1000;            // live check-in QR — 4 min
const KIOSK_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // counter display link — 30 days

// type: 'c' = check-in (short), 'k' = kiosk display (long)
function mintToken(gymCode, type, ttlMs) {
  const payload = `${gymCode}|${type}|${Date.now() + ttlMs}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', QR_KEY, iv);
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}
function readToken(token, expectedType) {
  try {
    const buf = Buffer.from(String(token || ''), 'base64url');
    if (buf.length < 29) return { invalid: true };
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', QR_KEY, iv);
    decipher.setAuthTag(tag);
    const txt = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const [gymCode, type, exp] = txt.split('|');
    if (!gymCode || !type || !exp) return { invalid: true };
    if (expectedType && type !== expectedType) return { invalid: true };
    if (Date.now() > Number(exp)) return { expired: true };
    return { gymCode };
  } catch (e) { return { invalid: true }; }
}
const mintCheckinToken = (gymCode) => mintToken(gymCode, 'c', CHECKIN_TTL_MS);
const readCheckinToken = (token) => readToken(token, 'c');
const mintKioskToken = (gymCode) => mintToken(gymCode, 'k', KIOSK_TTL_MS);
const readKioskToken = (token) => readToken(token, 'k');
const SETLOC_TTL_MS = 20 * 60 * 1000; // owner has 20 min to set the gym location
const mintSetlocToken = (gymCode) => mintToken(gymCode, 'l', SETLOC_TTL_MS);
const readSetlocToken = (token) => readToken(token, 'l');

// ===== GEOFENCE (static QR + GPS check so people can't check in from home) =====
const GEOFENCE_RADIUS_M = Number(process.env.GEOFENCE_RADIUS_M) || 100;
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// ok=true if the gym has no fence set yet, OR the member is within the radius
function checkGeofence(gym, lat, lng) {
  if (gym.lat == null || gym.lng == null) return { ok: true, noFence: true };
  const la = parseFloat(lat), ln = parseFloat(lng);
  if (isNaN(la) || isNaN(ln)) return { ok: false, noCoords: true };
  const d = distanceMeters(la, ln, gym.lat, gym.lng);
  return { ok: d <= GEOFENCE_RADIUS_M, distance: Math.round(d) };
}

// A page that grabs the browser's GPS once, then auto-submits it to `postUrl`.
// Browsers remember the location permission per site, so it isn't asked every time.
const geoLoaderPage = (gym, postUrl, heading, sub) => PAGE_SHELL(`
  <div class="ok"><div class="big">📍</div>
    <h1>${esc(heading || gym.name)}</h1>
    <p class="muted" id="msg">${esc(sub || 'Getting your location…')}</p>
  </div>
  <form id="geoForm" method="POST" action="${postUrl}" style="display:none">
    <input type="hidden" name="lat" id="lat"/><input type="hidden" name="lng" id="lng"/>
  </form>
  <div id="retry" style="display:none;margin-top:18px"><a class="btn" id="retryA" href="">Retry</a></div>
  <script>
  (function(){
    var msg=document.getElementById('msg');
    function fail(t){msg.textContent=t;var r=document.getElementById('retry');document.getElementById('retryA').href=location.href;r.style.display='block';}
    if(!navigator.geolocation){fail('Location not supported on this device.');return;}
    navigator.geolocation.getCurrentPosition(function(p){
      document.getElementById('lat').value=p.coords.latitude;
      document.getElementById('lng').value=p.coords.longitude;
      msg.textContent='Please wait…';
      document.getElementById('geoForm').submit();
    },function(){fail('📍 Please allow location access, then tap Retry.');},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  })();
  </script>`, gym.gymCode);

// Set-gym-location page for the OWNER: unlike the auto-submit geoLoaderPage, this
// SHOWS the detected location (coordinates + accuracy + a map) and only saves when
// the owner taps Confirm — so they can verify they're standing inside the gym.
const setlocPage = (gym, postUrl) => PAGE_SHELL(`
  <div class="ok"><div class="big">📍</div>
    <h1>Set gym location</h1>
    <p class="muted" id="msg">Stand inside ${esc(gym.name)} and allow location…</p>
  </div>
  <div id="result" style="display:none;margin-top:12px">
    <div style="background:#151725;border:1px solid #363a5c;border-radius:12px;padding:12px;text-align:left">
      <div style="font-size:12px;color:#9092b0">Detected location</div>
      <div id="coords" style="font-size:16px;font-weight:700;margin-top:2px"></div>
      <div id="acc" style="font-size:12px;margin-top:4px"></div>
    </div>
    <iframe id="map" style="width:100%;height:210px;border:0;border-radius:12px;margin-top:12px" loading="lazy"></iframe>
    <button type="button" id="save" style="margin-top:14px">✅ Confirm &amp; save this location</button>
    <a class="btn" href="" id="refresh" style="background:#222438;border:1px solid #6C63FF;color:#8B85FF;margin-top:10px">🔄 Refresh location</a>
  </div>
  <div id="retry" style="display:none;margin-top:18px"><a class="btn" id="retryA" href="">Retry</a></div>
  <form id="geoForm" method="POST" action="${postUrl}" style="display:none">
    <input type="hidden" name="lat" id="lat"/><input type="hidden" name="lng" id="lng"/>
  </form>
  <script>
  (function(){
    var msg=document.getElementById('msg');
    document.getElementById('refresh').href=location.href;
    function fail(t){msg.textContent=t;var r=document.getElementById('retry');document.getElementById('retryA').href=location.href;r.style.display='block';}
    if(!navigator.geolocation){fail('Location not supported on this device.');return;}
    navigator.geolocation.getCurrentPosition(function(p){
      var lat=p.coords.latitude, lng=p.coords.longitude, acc=Math.round(p.coords.accuracy||0);
      document.getElementById('lat').value=lat;
      document.getElementById('lng').value=lng;
      document.getElementById('coords').textContent=lat.toFixed(6)+', '+lng.toFixed(6);
      var accEl=document.getElementById('acc');
      accEl.textContent='± '+acc+' m accuracy'+(acc>50?' — move for a stronger signal':'');
      accEl.style.color=acc>50?'#FF9800':'#4CAF50';
      var d=0.004;
      document.getElementById('map').src='https://www.openstreetmap.org/export/embed.html?bbox='+(lng-d)+','+(lat-d)+','+(lng+d)+','+(lat+d)+'&layer=mapnik&marker='+lat+','+lng;
      msg.textContent='This is the location members will check in from. Confirm if correct.';
      document.getElementById('result').style.display='block';
    },function(){fail('📍 Please allow location access, then tap Retry.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    document.getElementById('save').addEventListener('click',function(){
      this.textContent='Saving…';this.disabled=true;document.getElementById('geoForm').submit();
    });
  })();
  </script>`, gym.gymCode);

const expiredPage = () => PAGE_SHELL(`<div class="ok"><div class="big">⌛</div><h1>QR expired</h1><p class="muted">This check-in QR has expired. Please scan the live QR shown at the gym counter again.</p></div>`);

// Hidden lat/lng inputs to carry the verified location through the next POST
const geoInputs = (lat, lng) => `<input type="hidden" name="lat" value="${lat != null ? esc(lat) : ''}"/><input type="hidden" name="lng" value="${lng != null ? esc(lng) : ''}"/>`;

// Phone-entry form (used after a valid geofenced scan, for people without a saved phone)
const phoneFormPage = (gym, lat, lng) => PAGE_SHELL(`
  <h1>🏋️ ${esc(gym.name)}</h1>
  <p class="sub">${esc(gym.location || '')} — Enter your number to check in</p>
  <form method="POST" action="/g/${gym.gymCode}/submit">
    ${geoInputs(lat, lng)}
    <label>Mobile Number</label>
    <input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number" required autofocus/>
    <button type="submit">Continue</button>
  </form>
  <p class="muted" style="text-align:center;margin-top:14px">Already a member? Just enter your number for instant check-in.<br/>New here? We'll ask your name on the next step.</p>`, gym.gymCode);

// New-person form (name + photo). Separate Camera & Gallery buttons so both work
// across browsers (capture="environment" forces the camera).
const newPersonFormPage = (gym, phone, lat, lng) => PAGE_SHELL(`
  <h1>🏋️ ${esc(gym.name)}</h1>
  <p class="sub">New here? Add your photo & name to finish checking in.</p>
  <form method="POST" action="/g/${gym.gymCode}/register" id="regForm">
    <input type="hidden" name="phone" value="${esc(phone)}"/>
    ${geoInputs(lat, lng)}
    <input type="hidden" name="avatar" id="avatar"/>
    <label>Your Photo <span style="color:#9092b0">(optional)</span></label>
    <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
      <img id="preview" alt="" style="width:60px;height:60px;border-radius:30px;object-fit:cover;background:#151725;border:1px solid #363a5c;display:none"/>
      <label for="camIn" style="flex:1;margin:0;text-align:center;padding:12px;border-radius:12px;background:#222438;border:1px solid #6C63FF;color:#8B85FF;font-weight:700">📷 Camera</label>
      <label for="galIn" style="flex:1;margin:0;text-align:center;padding:12px;border-radius:12px;background:#222438;border:1px solid #363a5c;color:#c2c3da;font-weight:700">🖼 Gallery</label>
    </div>
    <input type="file" id="camIn" accept="image/*" capture="environment" style="display:none"/>
    <input type="file" id="galIn" accept="image/*" style="display:none"/>
    <div id="pstatus" style="font-size:12px;color:#9092b0;margin-top:6px"></div>
    <label>Your Name</label>
    <input name="name" placeholder="e.g. Ramesh" required/>
    <label>Email <span style="color:#9092b0">(optional)</span></label>
    <input name="email" type="email" placeholder="you@email.com"/>
    <button type="submit">Register &amp; Check In</button>
  </form>
  <script>
  (function(){
    var av=document.getElementById('avatar'),pv=document.getElementById('preview'),st=document.getElementById('pstatus');
    function handle(inp){
      inp.addEventListener('change',function(){
        var f=inp.files&&inp.files[0];if(!f){return;}
        st.textContent='⏳ Processing photo…';
        var r=new FileReader();
        r.onload=function(e){
          var img=new Image();
          img.onload=function(){
            var data;
            try{
              var max=360,scale=Math.min(max/img.width,max/img.height,1),c=document.createElement('canvas');
              c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
              c.getContext('2d').drawImage(img,0,0,c.width,c.height);
              data=c.toDataURL('image/jpeg',0.5);
            }catch(err){data=e.target.result;}
            av.value=data;pv.src=data;pv.style.display='block';st.textContent='✅ Photo added';
          };
          img.onerror=function(){av.value=e.target.result;pv.src=e.target.result;pv.style.display='block';st.textContent='✅ Photo added';};
          img.src=e.target.result;
        };
        r.onerror=function(){st.textContent='Could not read photo, try again.';};
        r.readAsDataURL(f);
      });
    }
    handle(document.getElementById('camIn'));
    handle(document.getElementById('galIn'));
  })();
  </script>`, gym.gymCode);

// Existing user → ensure membership (trial) + mark today's attendance
async function attendUser(gym, user) {
  let membership = await Membership.findOne({ user: user._id, gym: gym._id });
  let isNew = false;
  if (!membership) {
    isNew = true;
    membership = await Membership.create({ user: user._id, gym: gym._id, plan: 'trial', fee: 0, joinDate: new Date(), dueDate: addMonths(new Date(), 0), status: 'active' });
    announceNewMember(gym._id, gym.name, { id: user._id, membershipId: membership._id, name: user.name, phone: user.phone, avatar: user.avatar }); // public join → notify whole team
  }
  if (memberBlockedMsg(membership)) return { blocked: true, blockedMsg: memberBlockedMsg(membership) };
  // Registration above happens any time; attendance is only marked during gym hours.
  if (!gymOpenNow(gym)) return { closed: true, isNew };
  const day = istDay();
  try {
    await GymAttendance.create({ user: user._id, gym: gym._id, membership: membership._id, day, method: 'self_scan' });
    // Notify the gym team on this check-in (owner + staff).
    announceCheckin(gym._id, gym.name, { id: user._id, membershipId: membership._id, name: user.name, avatar: user.avatar }, 'self_scan');
    return { duplicate: false };
  } catch (e) {
    if (e.code === 11000) return { duplicate: true };
    throw e;
  }
}

// Success-line for the web check-in page, aware of the "gym closed" case.
const attendMsg = (gym, r, okMsg) => {
  if (r.blocked) return r.blockedMsg || 'You cannot check in. Please contact the gym.';
  if (r.closed) {
    const l = gymHoursLabel(gym);
    return r.isNew
      ? `You're registered! ${gym.name} is closed right now${l ? ` (open ${l})` : ''}. Attendance is marked only during gym hours.`
      : `${gym.name} is closed right now${l ? ` (open ${l})` : ''}. Attendance can be marked only during gym hours.`;
  }
  return r.duplicate ? 'You were already checked in today.' : okMsg;
};

// @desc  STEP 1 — phone-only page. Registered members just enter their number;
//        new people are asked for a name on step 2. No cookie needed (works on iPhone).
exports.gymPublicPage = async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymCode: req.params.gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1><p class="muted">This gym QR is not valid.</p></div>`));

    // Static QR → grab the member's GPS once, then verify they're at the gym
    res.send(geoLoaderPage(gym, `/g/${gym.gymCode}/checkin`, gym.name, "Verifying you're at the gym…"));
  } catch (e) { res.status(500).send('Error'); }
};

// @desc  Geofenced check-in — receives the scanner's GPS, validates distance,
//        then marks attendance (saved phone) or asks for the number.
exports.gymGeoCheckin = async (req, res) => {
  try {
    const gym = await Gym.findOne({ gymCode: req.params.gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1></div>`));
    const { lat, lng } = req.body;
    const geo = checkGeofence(gym, lat, lng);
    if (!geo.ok) {
      const sub = geo.noCoords
        ? 'Could not read your location. Enable GPS and try again.'
        : `You're about ${geo.distance}m from ${esc(gym.name)}. Come to the gym to check in.`;
      return res.send(PAGE_SHELL(`<div class="ok"><div class="big">🚫</div><h1>Too far to check in</h1><p class="muted">${sub}</p><a class="btn" href="/g/${gym.gymCode}">Retry</a></div>`, gym.gymCode));
    }
    const savedPhone = getCookie(req, 'gphone');
    if (savedPhone) {
      const user = await User.findOne({ phone: savedPhone });
      if (user) {
        const r = await attendUser(gym, user);
        const hist = await attendanceHtml(gym, user);
        return res.send(attendPage(gym, r, user, 'Attendance marked. Have a great workout! 💪', hist));
      }
    }
    // No saved phone → ask for number (carry verified lat/lng forward)
    res.send(phoneFormPage(gym, lat, lng));
  } catch (e) { res.status(500).send('Error'); }
};

// @desc  Owner gets a one-time link to set the gym's GPS location (opened at the gym)
exports.getSetlocLink = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const gym = await Gym.findById(gymId).select('gymCode lat lng');
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });
    res.json({ success: true, data: { url: `${PUBLIC_BASE_URL}/g/setloc/${mintSetlocToken(gym.gymCode)}`, hasLocation: gym.lat != null && gym.lng != null } });
  } catch (e) { next(e); }
};

// @desc  Set-location capture page (grabs the owner's GPS while standing at the gym)
exports.gymSetlocPage = async (req, res) => {
  const r = readSetlocToken(req.params.token);
  if (r.expired || r.invalid || !r.gymCode) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⌛</div><h1>Link expired</h1><p class="muted">Open a fresh "Set gym location" link from the app.</p></div>`));
  const gym = await Gym.findOne({ gymCode: r.gymCode }).select('name gymCode');
  if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid</h1></div>`));
  res.send(setlocPage(gym, `/g/setloc/${req.params.token}`));
};

// @desc  Save the captured gym location
exports.gymSetlocSave = async (req, res) => {
  const r = readSetlocToken(req.params.token);
  if (r.expired || r.invalid || !r.gymCode) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⌛</div><h1>Link expired</h1></div>`));
  const lat = parseFloat(req.body.lat), lng = parseFloat(req.body.lng);
  if (isNaN(lat) || isNaN(lng)) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⚠️</div><h1>No location</h1><a class="btn" href="/g/setloc/${req.params.token}">Retry</a></div>`));
  const gymDoc = await Gym.findOne({ gymCode: r.gymCode }).select('owner name');
  if (!gymDoc) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid</h1></div>`));
  // Each gym needs its OWN location — block setting a spot already used by another
  // of the owner's gyms (e.g. owner setting both branches from the same place).
  const others = await Gym.find({ owner: gymDoc.owner, _id: { $ne: gymDoc._id } }).select('name lat lng');
  const clash = others.find(o => o.lat != null && o.lng != null && distanceMeters(lat, lng, o.lat, o.lng) < 40);
  if (clash) {
    return res.send(PAGE_SHELL(`<div class="ok"><div class="big">⚠️</div><h1>Location clash</h1>
      <p class="muted">This spot is already the location of <b>${esc(clash.name)}</b>. Each gym must have its own location — open this "Set gym location" link while standing <b>inside ${esc(gymDoc.name)}</b>.</p>
      <a class="btn" href="/g/setloc/${req.params.token}">Retry from the gym</a></div>`, r.gymCode));
  }
  await Gym.findOneAndUpdate({ gymCode: r.gymCode }, { lat, lng });
  const d = 0.004;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  res.send(PAGE_SHELL(`<div class="ok"><div class="big">✅</div><h1>Location saved!</h1>
    <p class="muted">${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
    <iframe src="${mapSrc}" style="width:100%;height:200px;border:0;border-radius:12px;margin:12px 0" loading="lazy"></iframe>
    <p class="muted">Members can now check in only when they're at the gym (within ${GEOFENCE_RADIUS_M}m).</p></div>`, r.gymCode));
};

// @desc  LIVE scan — opened by scanning the rotating counter QR (encrypted, ~4 min).
//        This is the ONLY entry that marks attendance.
exports.gymTokenPage = async (req, res) => {
  try {
    const r = readCheckinToken(req.params.token);
    if (r.expired) return res.send(expiredPage());
    if (r.invalid || !r.gymCode) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1><p class="muted">Please scan the QR at the gym counter.</p></div>`));
    const gym = await Gym.findOne({ gymCode: r.gymCode });
    if (!gym) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">❌</div><h1>Invalid QR</h1></div>`));

    const savedPhone = getCookie(req, 'gphone');
    if (savedPhone && req.query.new !== '1') {
      const user = await User.findOne({ phone: savedPhone });
      if (user) {
        const rr = await attendUser(gym, user);
        const hist = await attendanceHtml(gym, user);
        return res.send(attendPage(gym, rr, user, 'Attendance marked. Have a great workout! 💪', hist));
      }
    }
    // No saved phone → enter number (then /submit checks in)
    res.send(phoneFormPage(gym));
  } catch (e) { res.status(500).send('Error'); }
};

// @desc  Owner mints a fresh time-limited check-in token for the wall QR
exports.getCheckinToken = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const gym = await Gym.findById(gymId).select('gymCode');
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });
    const token = mintCheckinToken(gym.gymCode);
    res.json({ success: true, data: { url: `${PUBLIC_BASE_URL}/g/t/${token}`, expiresInSec: CHECKIN_TTL_MS / 1000 } });
  } catch (e) { next(e); }
};

// @desc  Owner gets a long-lived "counter display" link. Open it once on a screen/
//        tablet at the counter — it auto-refreshes the live QR by itself.
exports.getKioskLink = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    if (!(await ownsGym(req.user, gymId))) return res.status(403).json({ success: false, message: 'Not your gym' });
    const gym = await Gym.findById(gymId).select('gymCode');
    if (!gym) return res.status(404).json({ success: false, message: 'Gym not found' });
    res.json({ success: true, data: { url: `${PUBLIC_BASE_URL}/g/kiosk/${mintKioskToken(gym.gymCode)}` } });
  } catch (e) { next(e); }
};

// @desc  Kiosk QR image — mints a FRESH 4-min check-in token each call, returns SVG
exports.gymKioskQr = async (req, res) => {
  try {
    const r = readKioskToken(req.params.token);
    if (r.expired || r.invalid || !r.gymCode) return res.status(410).send('expired');
    const svg = await QRCode.toString(`${PUBLIC_BASE_URL}/g/t/${mintCheckinToken(r.gymCode)}`, {
      type: 'svg', margin: 1, width: 340, color: { dark: '#000000', light: '#FFFFFF' },
    });
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'no-store');
    res.send(svg);
  } catch (e) { res.status(500).send('error'); }
};

// @desc  Kiosk display page — full-screen auto-refreshing QR for the counter
exports.gymKioskPage = async (req, res) => {
  try {
    const tk = req.params.token;
    const r = readKioskToken(tk);
    if (r.expired || r.invalid || !r.gymCode) {
      return res.send(`<!doctype html><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><body style="background:#151725;color:#fff;font-family:sans-serif;text-align:center;padding:40px"><h1>⌛ Display link expired</h1><p style="color:#9092b0">Open a fresh counter display link from the FitAI app.</p></body>`);
    }
    const gym = await Gym.findOne({ gymCode: r.gymCode }).select('name');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(gym?.name || 'Gym')} — Check-in</title>
<style>*{box-sizing:border-box;font-family:-apple-system,Roboto,sans-serif}html,body{height:100%}body{margin:0;background:#151725;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px}
h1{margin:0 0 6px;font-size:30px;text-align:center}.sub{color:#9092b0;margin:0 0 24px;font-size:16px}
.qrwrap{background:#fff;border-radius:24px;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.qrwrap img{display:block;width:min(72vw,360px);height:auto}
.hint{margin-top:24px;color:#c2c3da;font-size:18px;text-align:center;max-width:480px;line-height:1.5}</style></head><body>
<h1>📷 ${esc(gym?.name || 'Gym')}</h1>
<p class="sub">Scan with your phone camera to check in</p>
<div class="qrwrap"><img id="qr" alt="Check-in QR" src="/g/kiosk/${tk}/qr?ts=${Date.now()}"/></div>
<div class="hint">This QR refreshes automatically. Keep this screen on at the counter.</div>
<script>
var tk=${JSON.stringify(tk)};
function refresh(){document.getElementById('qr').src='/g/kiosk/'+tk+'/qr?ts='+Date.now();}
setInterval(refresh,180000);
try{if('wakeLock' in navigator){var wl=function(){navigator.wakeLock.request('screen').catch(function(){});};wl();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')wl();});}}catch(e){}
</script></body></html>`);
  } catch (e) { res.status(500).send('error'); }
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

    // Re-check geofence so a number can't be POSTed straight from home
    const { lat, lng } = req.body;
    const geo = checkGeofence(gym, lat, lng);
    if (!geo.ok) {
      return res.send(PAGE_SHELL(`<div class="ok"><div class="big">🚫</div><h1>Too far to check in</h1><p class="muted">Please check in from the gym.</p><a class="btn" href="/g/${gym.gymCode}">Retry</a></div>`, gym.gymCode));
    }

    const user = await User.findOne({ phone });
    if (user) {
      // Registered already → just mark attendance (no name/email asked)
      const r = await attendUser(gym, user);
      const hist = await attendanceHtml(gym, user);
      res.setHeader('Set-Cookie', `gphone=${encodeURIComponent(phone)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`);
      return res.send(attendPage(gym, r, user, 'Attendance marked. Have a great workout! 💪', hist));
    }

    // New person → ask for name + photo (email optional), phone + location carried hidden
    res.send(newPersonFormPage(gym, phone, lat, lng));
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

    // Re-check geofence (location carried from the scan)
    const geo = checkGeofence(gym, req.body.lat, req.body.lng);
    if (!geo.ok) return res.send(PAGE_SHELL(`<div class="ok"><div class="big">🚫</div><h1>Too far to check in</h1><p class="muted">Please check in from the gym.</p><a class="btn" href="/g/${gym.gymCode}">Retry</a></div>`, gym.gymCode));

    const cleanEmail = email && /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase().trim() : null;
    const avatar = (typeof req.body.avatar === 'string' && req.body.avatar.startsWith('data:image/')) ? req.body.avatar : '';
    // Cloudinary: base64 photo → URL (falls back to base64 if not configured).
    const avatarUrl = await uploadAvatar(avatar);
    let user = await User.findOne({ phone }); // double-check (race)
    if (!user) {
      // user = await User.create({ ..., avatar }); // OLD: base64
      user = await User.create({ name, phone, email: cleanEmail || `g_${phone}_${Date.now()}@fitai.local`, role: 'user', avatar: avatarUrl });
    } else if (avatar && !user.avatar) {
      // try { user.avatar = avatar; await user.save(); } catch (e) {} // OLD: base64
      try { user.avatar = avatarUrl; await user.save(); } catch (e) {}
    }
    const r = await attendUser(gym, user);
    const hist = await attendanceHtml(gym, user);
    res.setHeader('Set-Cookie', `gphone=${encodeURIComponent(phone)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`);
    res.send(attendPage(gym, r, user, 'Registered & attendance marked! Pay your fee at the counter.', hist));
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
    res.json({ success: true, message: r.closed ? `${r.isNew ? 'Registered! ' : ''}${gym.name} is closed now — attendance is marked only during gym hours.` : `Welcome ${user.name}!`, gym: gym.name, duplicate: r.duplicate, closed: !!r.closed });
  } catch (e) { next(e); }
};

module.exports = exports;
