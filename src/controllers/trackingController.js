const Tracking = require('../models/Tracking');

// Helper: Get today's date in IST (UTC+5:30) at midnight
const getTodayIST = () => {
  const now = new Date();
  // Convert to IST by adding 5:30 hours
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  // Set to midnight IST (but store as UTC equivalent)
  istNow.setUTCHours(0, 0, 0, 0);
  return istNow;
};

// @desc    Log/update daily tracking
exports.logDaily = async (req, res, next) => {
  try {
    const today = getTodayIST();

    const tracking = await Tracking.findOneAndUpdate(
      { user: req.user.id, date: today },
      { $set: { ...req.body, user: req.user.id, date: today } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's tracking
exports.getToday = async (req, res, next) => {
  try {
    const today = getTodayIST();

    let tracking = await Tracking.findOne({ user: req.user.id, date: today });

    // Research-based calorie targets (ICMR 2020, ACSM, ISSN)
    // Safe deficit: TDEE - 500 (never below BMR) for ~0.5 kg/week loss
    // Surplus: +300-400 for lean gain
    const bmr = req.user.bmr || 1500;
    const tdee = req.user.dailyCalories || 2000;
    const safeDeficit = Math.max(bmr, tdee - 500);
    const goalCalMap = {
      weight_loss: safeDeficit,
      fat_loss: safeDeficit,
      weight_gain: Math.round(tdee + 400),
      muscle_building: Math.round(tdee + 300),
      height_growth: Math.round(tdee * 1.1),
      gym_workout: Math.round(tdee * 1.1),
      home_workout: tdee,
      maintenance: tdee,
    };
    const caloriesGoal = goalCalMap[req.user.fitnessGoal] || tdee;

    if (!tracking) {
      tracking = { weight: req.user.weight, caloriesConsumed: 0, caloriesBurned: 0, waterIntake: 0, steps: 0, sleepHours: 0, workoutCompleted: false, mood: null, caloriesGoal, waterGoal: 8, stepsGoal: 10000, sleepGoal: 8, mealsLogged: [], workoutMinutes: 0 };
    } else {
      tracking = tracking.toObject();
      tracking.caloriesGoal = caloriesGoal; // Always override with goal-adjusted value
    }

    res.json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};

// @desc    Add water intake
exports.addWater = async (req, res, next) => {
  try {
    const today = getTodayIST();

    const tracking = await Tracking.findOneAndUpdate(
      { user: req.user.id, date: today },
      { $inc: { waterIntake: req.body.glasses || 1 }, $setOnInsert: { user: req.user.id, date: today } },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: { waterIntake: tracking.waterIntake, waterGoal: tracking.waterGoal } });
  } catch (error) {
    next(error);
  }
};

// @desc    Log meal
exports.logMeal = async (req, res, next) => {
  try {
    const today = getTodayIST();

    const { mealType, items, totalCalories } = req.body;

    const tracking = await Tracking.findOneAndUpdate(
      { user: req.user.id, date: today },
      {
        $push: { mealsLogged: { mealType, items, totalCalories } },
        $inc: { caloriesConsumed: totalCalories || 0 },
        $setOnInsert: { user: req.user.id, date: today },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly report
exports.getWeeklyReport = async (req, res, next) => {
  try {
    const today = getTodayIST();
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1); // end of today IST
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago IST

    const records = await Tracking.find({
      user: req.user.id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const summary = {
      totalDays: records.length,
      avgCalories: records.length ? Math.round(records.reduce((s, r) => s + r.caloriesConsumed, 0) / records.length) : 0,
      avgWater: records.length ? parseFloat((records.reduce((s, r) => s + r.waterIntake, 0) / records.length).toFixed(1)) : 0,
      avgSleep: records.length ? parseFloat((records.reduce((s, r) => s + r.sleepHours, 0) / records.length).toFixed(1)) : 0,
      avgSteps: records.length ? Math.round(records.reduce((s, r) => s + r.steps, 0) / records.length) : 0,
      workoutsCompleted: records.filter(r => r.workoutCompleted).length,
      weightChange: records.length >= 2 ? parseFloat((records[records.length - 1].weight - records[0].weight).toFixed(1)) : 0,
      dailyData: records,
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly progress
exports.getMonthlyProgress = async (req, res, next) => {
  try {
    const today = getTodayIST();
    const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const records = await Tracking.find({
      user: req.user.id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }).select('date weight caloriesConsumed waterIntake steps sleepHours workoutCompleted');

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};
