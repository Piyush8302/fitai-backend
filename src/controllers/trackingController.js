const Tracking = require('../models/Tracking');

// @desc    Log/update daily tracking
exports.logDaily = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let tracking = await Tracking.findOne({ user: req.user.id, date: today });
    if (!tracking) {
      const isWeightLoss = req.user.fitnessGoal === 'weight_loss' || req.user.fitnessGoal === 'fat_loss';
      const caloriesGoal = isWeightLoss ? (req.user.bmr || 1500) : (req.user.dailyCalories || 2000);
      tracking = { weight: req.user.weight, caloriesConsumed: 0, caloriesBurned: 0, waterIntake: 0, steps: 0, sleepHours: 0, workoutCompleted: false, mood: null, caloriesGoal, waterGoal: 8, stepsGoal: 10000, sleepGoal: 8 };
    }

    res.json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};

// @desc    Add water intake
exports.addWater = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const records = await Tracking.find({
      user: req.user.id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }).select('date weight caloriesConsumed waterIntake steps sleepHours workoutCompleted');

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};
