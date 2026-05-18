const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  muscle: { type: String, required: true }, // chest, back, legs, arms, shoulders, abs, full_body
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  sets: { type: Number, default: 3 },
  reps: { type: String, default: '12' }, // "12" or "30 sec"
  restSeconds: { type: Number, default: 60 },
  caloriesBurned: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // minutes
  instructions: { type: String },
  commonMistakes: { type: String },
  imageUrl: { type: String },
  videoUrl: { type: String },
  equipment: { type: String, enum: ['none', 'dumbbells', 'barbell', 'machine', 'bands', 'bodyweight'], default: 'bodyweight' },
  injuryTips: { type: String },
});

const workoutSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_building', 'fat_loss', 'home', 'gym', 'stretching', 'cardio', 'yoga'],
    required: true,
  },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  duration: { type: Number, required: true }, // total minutes
  caloriesBurned: { type: Number, default: 0 },
  exercises: [exerciseSchema],
  targetMuscles: [String],
  equipment: [String],
  imageUrl: { type: String },
  isPremium: { type: Boolean, default: false },
  dayOfWeek: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'any'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Workout', workoutSchema);
