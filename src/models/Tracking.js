const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },

  // Weight
  weight: { type: Number },

  // Calories
  caloriesConsumed: { type: Number, default: 0 },
  caloriesBurned: { type: Number, default: 0 },
  caloriesGoal: { type: Number, default: 2000 },

  // Water
  waterIntake: { type: Number, default: 0 }, // glasses
  waterGoal: { type: Number, default: 8 },

  // Steps
  steps: { type: Number, default: 0 },
  stepsGoal: { type: Number, default: 10000 },

  // Sleep
  sleepHours: { type: Number, default: 0 },
  sleepGoal: { type: Number, default: 8 },

  // Workout
  workoutCompleted: { type: Boolean, default: false },
  workoutMinutes: { type: Number, default: 0 },
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
  proteinConsumed: { type: Number, default: 0 },
  carbsConsumed: { type: Number, default: 0 },
  fatConsumed: { type: Number, default: 0 },

  notes: { type: String },
}, { timestamps: true });

// Compound index: one entry per user per day
trackingSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Tracking', trackingSchema);
