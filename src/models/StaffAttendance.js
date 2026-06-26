const mongoose = require('mongoose');

// Staff check-in record. Kept separate from member GymAttendance so staff
// presence never inflates member footfall / dashboard stats.
const staffAttendanceSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  day: { type: String, required: true },  // 'YYYY-MM-DD' (IST) — for dedupe
  checkInAt: { type: Date, default: Date.now },
  method: { type: String, enum: ['reception', 'self', 'manual'], default: 'reception' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// One attendance per staff per gym per day
staffAttendanceSchema.index({ staff: 1, gym: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('StaffAttendance', staffAttendanceSchema);
