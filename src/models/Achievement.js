const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['streak', 'workout_count', 'water_goal', 'weight_milestone', 'first_workout', 'first_meal_log', 'chat_starter', 'profile_complete', 'seven_day_streak', 'thirty_day_streak', 'hundred_workouts'],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  icon: { type: String, default: '🏆' },
  unlockedAt: { type: Date, default: Date.now },
}, { timestamps: true });

achievementSchema.index({ user: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Achievement', achievementSchema);
