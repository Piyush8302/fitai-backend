const mongoose = require('mongoose');

// One row per (user, gym). A user can have many memberships across gyms.
const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  plan: { type: String, enum: ['trial', 'day_pass', 'monthly', 'quarterly', 'half_yearly', 'yearly'], default: 'monthly' },
  fee: { type: Number, default: 0 },
  joinDate: { type: Date, default: Date.now },
  dueDate: { type: Date },          // next fee due date
  lastPaidDate: { type: Date },
  status: { type: String, enum: ['active', 'expired', 'frozen'], default: 'active' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // owner/staff who added
  note: { type: String },
}, { timestamps: true });

// One membership per user per gym
membershipSchema.index({ user: 1, gym: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
