const mongoose = require('mongoose');

const mealItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: String }, // "1 cup", "200g"
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
});

const mealSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['breakfast', 'mid_morning', 'lunch', 'evening_snack', 'dinner', 'pre_workout', 'post_workout'],
    required: true,
  },
  time: { type: String }, // "8:00 AM"
  items: [mealItemSchema],
  totalCalories: { type: Number, default: 0 },
  totalProtein: { type: Number, default: 0 },
});

const dietPlanSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  goal: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_building', 'maintenance', 'keto', 'intermittent_fasting'],
    required: true,
  },
  dietType: { type: String, enum: ['veg', 'non_veg', 'vegan', 'eggetarian'], default: 'veg' },
  totalCalories: { type: Number },
  totalProtein: { type: Number },
  meals: [mealSchema],
  waterIntake: { type: Number, default: 3 }, // liters
  dayOfWeek: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'any'] },
  isPremium: { type: Boolean, default: false },
  imageUrl: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('DietPlan', dietPlanSchema);
