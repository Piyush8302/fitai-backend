const mongoose = require('mongoose');

// A gym (branch). One owner can have many gyms.
const gymSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: { type: String, trim: true },
  city: { type: String, trim: true },
  phone: { type: String, trim: true },
  // Short unique code encoded in the gym's wall QR (for member self check-in)
  gymCode: { type: String, unique: true, index: true },
  // Optional geofence for self check-in
  lat: { type: Number },
  lng: { type: Number },
  // Operating hours (IST, "HH:MM"). Gyms often run two shifts (morning + evening),
  // so hours are a list of open–close slots; owners can add extra/between slots.
  // Attendance is marked only if the current time is inside ANY slot; registration
  // is always allowed. Empty slots = open 24×7 (no restriction).
  slots: {
    type: [{ open: { type: String, trim: true }, close: { type: String, trim: true }, _id: false }],
    default: [],
  },
  // Legacy single window (kept for backward compatibility; slots take priority).
  openTime: { type: String, trim: true, default: '' },
  closeTime: { type: String, trim: true, default: '' },
  // Owner-set fee plans (₹). Monthly & Quarterly are the common presets; the rest
  // are optional. Used to pre-fill the fee when adding a member / marking payment.
  planPrices: {
    monthly: { type: Number, default: 0 },
    quarterly: { type: Number, default: 0 },
    half_yearly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Generate a readable unique gym code before save
gymSchema.pre('save', function (next) {
  if (!this.gymCode) {
    this.gymCode = 'GYM' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Gym', gymSchema);
