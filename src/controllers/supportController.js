const SupportMessage = require('../models/SupportMessage');
const Gym = require('../models/Gym');
const { sendSupportEmail } = require('../utils/emailService');

// @desc  Submit a "Contact Us" message (gym owner / staff / user)
exports.submitMessage = async (req, res, next) => {
  try {
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Please enter a message' });

    const u = req.user;
    let gymName = '';
    if (['gym_owner', 'gym_staff'].includes(u.role)) {
      const gym = (u.role === 'gym_staff' && u.staffGym)
        ? await Gym.findById(u.staffGym).select('name')
        : await Gym.findOne({ owner: u._id }).select('name');
      gymName = gym?.name || u.requestedGymName || '';
    }

    const doc = await SupportMessage.create({
      user: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, gymName, message,
    });

    // Notify the super-admin by email (best-effort)
    try { await sendSupportEmail({ name: u.name, email: u.email, phone: u.phone, role: u.role, gymName, message }); }
    catch (e) { console.log('support email failed:', e.message); }

    res.status(201).json({ success: true, message: 'Message sent! Our team will get back to you soon.', data: doc._id });
  } catch (e) { next(e); }
};

// @desc  Admin — list support messages (filter: open | resolved | all)
exports.getMessages = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const [messages, unread] = await Promise.all([
      SupportMessage.find(filter).sort({ createdAt: -1 }).limit(300),
      SupportMessage.countDocuments({ isRead: false }),
    ]);
    res.json({ success: true, count: messages.length, unread, data: messages });
  } catch (e) { next(e); }
};

// @desc  Admin — mark a message resolved
exports.resolveMessage = async (req, res, next) => {
  try {
    const doc = await SupportMessage.findByIdAndUpdate(req.params.id, { status: 'resolved', isRead: true }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
};

// @desc  Admin — delete a message
exports.deleteMessage = async (req, res, next) => {
  try {
    await SupportMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
};
