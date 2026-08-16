const mongoose = require('mongoose');
const { BADGE_TYPES } = require('../utils/badges');

const achievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Taken straight from the catalogue. This list was maintained by hand and had
  // fallen four badges behind it — saving one of those threw a validation error,
  // which aborted the unlock loop and stopped every later badge too.
  type: {
    type: String,
    enum: BADGE_TYPES,
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: '🏆' },
  unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true });

achievementSchema.index({ user: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Achievement', achievementSchema);
