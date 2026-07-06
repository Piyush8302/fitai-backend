const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Optional: phone-only members/staff have no email until they add one. Unique
  // is enforced only among users who actually have an email (sparse index).
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
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
  startWeight: { type: Number }, // weight when goal was set — for progress %
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
  goalTimeline: { type: Number }, // months to achieve goal
  goalStartDate: { type: Date },  // when user started this goal

  // BMI & Health
  bmi: { type: Number },
  bmr: { type: Number },
  dailyCalories: { type: Number },
  proteinNeed: { type: Number },

  // Subscription
  isPremium: { type: Boolean, default: false },
  subscriptionPlan: { type: String, enum: ['free', 'monthly', 'yearly'], default: 'free' },
  subscriptionExpiry: { type: Date },

  // Chat limits (free users)
  dailyChatCount: { type: Number, default: 0 },
  lastChatDate: { type: String }, // 'YYYY-MM-DD'

  // App
  isProfileComplete: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  fcmToken: { type: String },
  expoPushToken: { type: String },
  otp: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  pendingEmail: { type: String },
  pendingPhone: { type: String },

  role: { type: String, enum: ['user', 'admin', 'gym_owner', 'gym_staff'], default: 'user' },
  // Gym-owner approval workflow (super-admin approves in the admin panel)
  ownerStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  requestedGymName: { type: String, trim: true },
  ownerRequestedAt: { type: Date },
  // For gym_staff: which gym they work at (set by the owner)
  staffGym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym' },
  staffRole: { type: String, trim: true },   // e.g. 'Receptionist', 'Trainer'
  staffSalary: { type: Number },             // monthly salary (optional)
  staffJoinDate: { type: Date },             // when added as staff
  canAccessCashbook: { type: Boolean, default: false }, // owner can grant a staff cashbook access
  canAccessReports: { type: Boolean, default: false },  // owner can grant a staff reports access
  // Per-staff action rights (owner grants). Delete stays owner-only (not here).
  canAddMember: { type: Boolean, default: false },
  canMarkPayment: { type: Boolean, default: false },
  canMarkPresent: { type: Boolean, default: false },   // mark member attendance / present
  canManageStatus: { type: Boolean, default: false },  // mark left / block / deactivate
  canEditGym: { type: Boolean, default: false },
  canSetLocation: { type: Boolean, default: false }, // set the gym's GPS location
  // Staff account status (owner-managed). Non-active staff can't perform gym actions.
  staffStatus: { type: String, enum: ['active', 'inactive', 'blocked', 'left'], default: 'active' },
}, { timestamps: true });

// Never store an empty-string email — normalise '' to undefined so the sparse
// unique index skips it (empty strings would otherwise collide with each other).
userSchema.pre('save', function (next) {
  if (this.email === '' || this.email === null) this.email = undefined;
  next();
});

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
