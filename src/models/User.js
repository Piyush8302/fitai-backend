const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, minlength: 6, select: false },
  avatar: { type: String, default: '' },
  authProvider: { type: String, enum: ['local', 'google', 'otp'], default: 'local' },

  // Profile
  age: { type: Number, min: 10, max: 100 },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  height: { type: Number }, // in cm
  weight: { type: Number }, // in kg
  targetWeight: { type: Number },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'],
    default: 'moderately_active',
  },
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_building', 'fat_loss', 'height_growth', 'maintenance', 'home_workout', 'gym_workout'],
  },
  dietPreference: { type: String, enum: ['veg', 'non_veg', 'vegan', 'eggetarian'], default: 'veg' },

  // BMI & Health
  bmi: { type: Number },
  bmr: { type: Number },
  dailyCalories: { type: Number },
  proteinNeed: { type: Number },

  // Subscription
  isPremium: { type: Boolean, default: false },
  subscriptionPlan: { type: String, enum: ['free', 'monthly', 'yearly'], default: 'free' },
  subscriptionExpiry: { type: Date },

  // App
  isProfileComplete: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  fcmToken: { type: String },
  expoPushToken: { type: String },
  otp: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  pendingEmail: { type: String },
  pendingPhone: { type: String },

  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Calculate BMI, BMR, calories on save
userSchema.pre('save', function (next) {
  if (this.height && this.weight) {
    const heightM = this.height / 100;
    this.bmi = parseFloat((this.weight / (heightM * heightM)).toFixed(1));

    // Mifflin-St Jeor BMR
    if (this.gender === 'male') {
      this.bmr = Math.round(10 * this.weight + 6.25 * this.height - 5 * (this.age || 25) + 5);
    } else {
      this.bmr = Math.round(10 * this.weight + 6.25 * this.height - 5 * (this.age || 25) - 161);
    }

    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extra_active: 1.9 };
    this.dailyCalories = Math.round(this.bmr * (multipliers[this.activityLevel] || 1.55));
    this.proteinNeed = Math.round(this.weight * 1.6);
  }
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.getSignedToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

module.exports = mongoose.model('User', userSchema);
