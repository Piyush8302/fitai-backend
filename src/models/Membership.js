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
  // active = normal • inactive = temporarily deactivated • blocked = banned (can't
  // check in) • left = member quit the gym • expired/frozen = legacy states.
  status: { type: String, enum: ['active', 'expired', 'frozen', 'inactive', 'blocked', 'left'], default: 'active' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // owner/staff who added
  note: { type: String },

  // ---- Gym-side profile (what the gym collects at registration) ----
  // Kept HERE and not on User on purpose: the gym's copy of a member's photo and
  // details belongs to the gym. The owner editing it must never change what the
  // member sees as their own profile photo in the FitAI app (User.avatar).
  photo: { type: String },            // gym's photo of this member (Cloudinary URL / base64)
  email: { type: String },            // email given to THIS gym
  gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  dob: { type: Date },
  address: { type: String },
  emergencyName: { type: String },
  emergencyPhone: { type: String },
  bloodGroup: { type: String },
  goal: { type: String },             // e.g. weight loss / muscle gain
  height: { type: Number },           // cm
  weight: { type: Number },           // kg
  // How this membership was created — self scan in the app, the public web
  // check-in page, or added by the owner/staff at the counter.
  registeredVia: { type: String, enum: ['app_scan', 'web', 'counter'], default: 'counter' },
}, { timestamps: true });

// One membership per user per gym
membershipSchema.index({ user: 1, gym: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
