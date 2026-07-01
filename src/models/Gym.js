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
  // Operating hours (IST, "HH:MM"). If both set, self/web check-in attendance is
  // only marked within this window; registration is still allowed any time.
  // Empty = open 24h (no restriction).
  openTime: { type: String, trim: true, default: '' },
  closeTime: { type: String, trim: true, default: '' },
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
