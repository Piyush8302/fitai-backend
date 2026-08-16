const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },

  // Every number below carries a range. The app guards its own inputs, but the
  // API is reachable without the app, and until these were added the server
  // happily stored steps: 999999999999, sleepHours: 9999 and a NEGATIVE
  // caloriesBurned — all of which then fed the weekly and monthly reports.
  // logDaily passes runValidators, so these are enforced on update too.

  // Weight
  weight: { type: Number, min: 20, max: 300 },

  // Calories
  caloriesConsumed: { type: Number, default: 0, min: 0, max: 30000 },
  caloriesBurned: { type: Number, default: 0, min: 0, max: 30000 },
  caloriesGoal: { type: Number, default: 2000, min: 500, max: 20000 },

  // Water
  waterIntake: { type: Number, default: 0, min: 0, max: 60 }, // glasses
  waterGoal: { type: Number, default: 8, min: 1, max: 60 },

  // Steps
  steps: { type: Number, default: 0, min: 0, max: 200000 },
  stepsGoal: { type: Number, default: 10000, min: 100, max: 200000 },

  // Sleep
  sleepHours: { type: Number, default: 0, min: 0, max: 24 },
  sleepGoal: { type: Number, default: 8, min: 1, max: 24 },

  // Workout
  workoutCompleted: { type: Boolean, default: false },
  workoutMinutes: { type: Number, default: 0, min: 0, max: 1440 },
  workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout' },

  // Meals logged
  mealsLogged: [{
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    items: [{ name: String, calories: Number, protein: Number }],
    totalCalories: { type: Number, default: 0 },
  }],

  // Mood
  mood: { type: String, enum: ['great', 'good', 'okay', 'bad', 'terrible'] },

  // Macros
  proteinConsumed: { type: Number, default: 0, min: 0, max: 2000 },
  carbsConsumed: { type: Number, default: 0, min: 0, max: 3000 },
  fatConsumed: { type: Number, default: 0, min: 0, max: 2000 },

  notes: { type: String, maxlength: 2000 },
}, { timestamps: true });

// Compound index: one entry per user per day
trackingSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Tracking', trackingSchema);
