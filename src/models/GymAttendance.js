const mongoose = require('mongoose');

// One check-in record. Tied to a user + gym (membership optional for walk-ins).
const gymAttendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
  day: { type: String, required: true },  // 'YYYY-MM-DD' (IST) — for dedupe
  checkInAt: { type: Date, default: Date.now },
  // auto_geo = automatic check-in when the member's phone enters the gym geofence
  method: { type: String, enum: ['staff_scan', 'self_scan', 'manual', 'auto_geo'], default: 'staff_scan' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// One attendance per user per gym per day
gymAttendanceSchema.index({ user: 1, gym: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('GymAttendance', gymAttendanceSchema);
