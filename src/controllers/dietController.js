const DietPlan = require('../models/DietPlan');

// @desc    Get all diet plans
exports.getDietPlans = async (req, res, next) => {
  try {
    const { goal, dietType, isPremium, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (goal) filter.goal = goal;
    if (dietType) filter.dietType = dietType;
    if (isPremium !== undefined) filter.isPremium = isPremium === 'true';

    if (!req.user?.isPremium && req.user?.role !== 'admin') {
      filter.isPremium = false;
    }

    const total = await DietPlan.countDocuments(filter);
    const plans = await DietPlan.find(filter)
      .skip((page - 1) * limit).limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({ success: true, count: plans.length, total, page: parseInt(page), data: plans });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single diet plan
exports.getDietPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Diet plan not found' });
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI personalized diet plan
exports.getAIDietPlan = async (req, res, next) => {
  try {
    const user = req.user;
    const { goal, dietType } = req.query;

    const userGoal = goal || user.fitnessGoal || 'maintenance';
    const userDiet = dietType || user.dietPreference || 'veg';
    const calories = user.dailyCalories || 2000;

    const plan = generateDietPlan(userGoal, userDiet, calories, user);
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

// @desc    Create diet plan (Admin)
exports.createDietPlan = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;
    const plan = await DietPlan.create(req.body);
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

// @desc    Update diet plan (Admin)
exports.updateDietPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Diet plan not found' });
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete diet plan (Admin)
exports.deleteDietPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Diet plan not found' });
    res.json({ success: true, message: 'Diet plan deleted' });
  } catch (error) {
    next(error);
  }
};

// ---- Indian Diet Generator ----
function generateDietPlan(goal, dietType, targetCalories, user) {
  const vegMeals = {
    breakfast: [
      { name: 'Poha with Peanuts', quantity: '1 plate', calories: 250, protein: 6, carbs: 40, fat: 8, fiber: 3 },
      { name: 'Moong Dal Chilla', quantity: '2 pcs', calories: 200, protein: 12, carbs: 25, fat: 5, fiber: 4 },
      { name: 'Oats Upma', quantity: '1 bowl', calories: 220, protein: 8, carbs: 35, fat: 6, fiber: 5 },
      { name: 'Idli Sambar', quantity: '3 pcs', calories: 280, protein: 10, carbs: 45, fat: 4, fiber: 4 },
      { name: 'Besan Chilla', quantity: '2 pcs', calories: 230, protein: 14, carbs: 22, fat: 8, fiber: 5 },
    ],
    mid_morning: [
      { name: 'Mixed Fruits', quantity: '1 bowl', calories: 100, protein: 1, carbs: 25, fat: 0, fiber: 4 },
      { name: 'Buttermilk (Chaas)', quantity: '1 glass', calories: 40, protein: 3, carbs: 4, fat: 1, fiber: 0 },
      { name: 'Roasted Chana', quantity: '50g', calories: 180, protein: 10, carbs: 28, fat: 3, fiber: 6 },
      { name: 'Banana + Almonds', quantity: '1 + 10 pcs', calories: 160, protein: 5, carbs: 28, fat: 6, fiber: 3 },
    ],
    lunch: [
      { name: 'Dal Rice + Salad', quantity: '1 plate', calories: 450, protein: 15, carbs: 65, fat: 10, fiber: 8 },
      { name: 'Roti + Paneer Sabzi', quantity: '2 roti + 1 bowl', calories: 480, protein: 22, carbs: 50, fat: 18, fiber: 5 },
      { name: 'Rajma Chawal', quantity: '1 plate', calories: 420, protein: 16, carbs: 60, fat: 8, fiber: 10 },
      { name: 'Chole + Roti + Raita', quantity: '1 plate', calories: 500, protein: 18, carbs: 58, fat: 14, fiber: 9 },
    ],
    evening_snack: [
      { name: 'Sprouts Salad', quantity: '1 bowl', calories: 120, protein: 8, carbs: 18, fat: 2, fiber: 6 },
      { name: 'Makhana (Fox Nuts)', quantity: '50g', calories: 180, protein: 5, carbs: 30, fat: 4, fiber: 3 },
      { name: 'Peanut Butter Toast', quantity: '1 slice', calories: 200, protein: 8, carbs: 18, fat: 12, fiber: 2 },
    ],
    dinner: [
      { name: 'Roti + Mixed Veg', quantity: '2 roti + 1 bowl', calories: 350, protein: 10, carbs: 48, fat: 10, fiber: 8 },
      { name: 'Palak Paneer + Roti', quantity: '1 bowl + 2 roti', calories: 420, protein: 20, carbs: 42, fat: 16, fiber: 6 },
      { name: 'Khichdi + Curd', quantity: '1 bowl', calories: 320, protein: 12, carbs: 50, fat: 6, fiber: 5 },
      { name: 'Dalia (Broken Wheat)', quantity: '1 bowl', calories: 280, protein: 8, carbs: 45, fat: 5, fiber: 7 },
    ],
    pre_workout: [
      { name: 'Banana', quantity: '1 large', calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
      { name: 'Black Coffee', quantity: '1 cup', calories: 5, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    ],
    post_workout: [
      { name: 'Paneer Bhurji', quantity: '100g', calories: 260, protein: 20, carbs: 5, fat: 18, fiber: 1 },
      { name: 'Protein Shake (Whey)', quantity: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 1, fiber: 0 },
    ],
  };

  const nonVegAddons = {
    breakfast: [
      { name: 'Egg Bhurji + Toast', quantity: '2 eggs + 1 toast', calories: 280, protein: 18, carbs: 20, fat: 14, fiber: 1 },
      { name: 'Boiled Eggs', quantity: '3 pcs', calories: 210, protein: 18, carbs: 0, fat: 15, fiber: 0 },
    ],
    lunch: [
      { name: 'Chicken Curry + Rice', quantity: '1 plate', calories: 520, protein: 35, carbs: 55, fat: 14, fiber: 3 },
      { name: 'Fish Curry + Roti', quantity: '1 plate', calories: 450, protein: 30, carbs: 40, fat: 12, fiber: 2 },
    ],
    dinner: [
      { name: 'Grilled Chicken + Salad', quantity: '150g + bowl', calories: 350, protein: 40, carbs: 10, fat: 12, fiber: 4 },
      { name: 'Egg Curry + Roti', quantity: '2 eggs + 2 roti', calories: 400, protein: 20, carbs: 42, fat: 16, fiber: 3 },
    ],
    post_workout: [
      { name: 'Chicken Breast', quantity: '150g', calories: 230, protein: 43, carbs: 0, fat: 5, fiber: 0 },
    ],
  };

  // Vegan replacements (no dairy: no paneer, curd, ghee, raita, whey, buttermilk)
  const veganMeals = {
    breakfast: vegMeals.breakfast, // all already vegan-safe
    mid_morning: [
      { name: 'Mixed Fruits', quantity: '1 bowl', calories: 100, protein: 1, carbs: 25, fat: 0, fiber: 4 },
      { name: 'Roasted Chana', quantity: '50g', calories: 180, protein: 10, carbs: 28, fat: 3, fiber: 6 },
      { name: 'Banana + Almonds', quantity: '1 + 10 pcs', calories: 160, protein: 5, carbs: 28, fat: 6, fiber: 3 },
      { name: 'Coconut Water', quantity: '1 glass', calories: 46, protein: 0.5, carbs: 11, fat: 0, fiber: 0 },
    ],
    lunch: [
      { name: 'Dal Rice + Salad', quantity: '1 plate', calories: 450, protein: 15, carbs: 65, fat: 10, fiber: 8 },
      { name: 'Rajma Chawal', quantity: '1 plate', calories: 420, protein: 16, carbs: 60, fat: 8, fiber: 10 },
      { name: 'Chole + Roti + Salad', quantity: '1 plate', calories: 480, protein: 18, carbs: 58, fat: 12, fiber: 9 },
      { name: 'Tofu Curry + 2 Roti', quantity: '1 plate', calories: 400, protein: 20, carbs: 42, fat: 14, fiber: 5 },
      { name: 'Soya Chunk Curry + Rice', quantity: '1 plate', calories: 440, protein: 28, carbs: 55, fat: 10, fiber: 6 },
    ],
    evening_snack: vegMeals.evening_snack, // all vegan-safe
    dinner: [
      { name: 'Roti + Mixed Veg', quantity: '2 roti + 1 bowl', calories: 350, protein: 10, carbs: 48, fat: 10, fiber: 8 },
      { name: 'Dalia (Broken Wheat)', quantity: '1 bowl', calories: 280, protein: 8, carbs: 45, fat: 5, fiber: 7 },
      { name: 'Tofu Stir Fry + Rice', quantity: '1 plate', calories: 380, protein: 18, carbs: 48, fat: 12, fiber: 4 },
      { name: 'Masoor Dal + 2 Roti', quantity: '1 bowl + 2 roti', calories: 360, protein: 14, carbs: 50, fat: 6, fiber: 6 },
    ],
    pre_workout: vegMeals.pre_workout, // banana + black coffee = vegan
    post_workout: [
      { name: 'Soy Protein Shake', quantity: '1 scoop', calories: 130, protein: 22, carbs: 5, fat: 2, fiber: 1 },
      { name: 'Tofu Scramble', quantity: '100g', calories: 180, protein: 16, carbs: 4, fat: 10, fiber: 1 },
    ],
  };

  // Egg-only addons for eggetarian (no meat/fish)
  const eggAddons = {
    breakfast: [
      { name: 'Egg Bhurji + Toast', quantity: '2 eggs + 1 toast', calories: 280, protein: 18, carbs: 20, fat: 14, fiber: 1 },
      { name: 'Boiled Eggs', quantity: '3 pcs', calories: 210, protein: 18, carbs: 0, fat: 15, fiber: 0 },
    ],
    lunch: [
      { name: 'Egg Fried Rice', quantity: '1 plate', calories: 420, protein: 16, carbs: 55, fat: 14, fiber: 2 },
    ],
    dinner: [
      { name: 'Egg Curry + Roti', quantity: '2 eggs + 2 roti', calories: 400, protein: 20, carbs: 42, fat: 16, fiber: 3 },
    ],
    post_workout: [
      { name: 'Boiled Eggs + Banana', quantity: '3 eggs + 1 banana', calories: 315, protein: 19, carbs: 27, fat: 15, fiber: 3 },
    ],
  };

  // Build meal source based on diet type
  let mealSource;
  if (dietType === 'vegan') {
    mealSource = veganMeals;
  } else if (dietType === 'eggetarian') {
    mealSource = { ...vegMeals };
    Object.keys(eggAddons).forEach(key => {
      mealSource[key] = [...(vegMeals[key] || []), ...eggAddons[key]];
    });
  } else if (dietType === 'non_veg') {
    mealSource = { ...vegMeals };
    Object.keys(nonVegAddons).forEach(key => {
      mealSource[key] = [...(vegMeals[key] || []), ...nonVegAddons[key]];
    });
  } else {
    // veg (default)
    mealSource = vegMeals;
  }

  // Goal-adjusted target — same single source of truth as tracking/chat/BMI.
  // The plan is built TO this budget so plan total ≈ daily target.
  const { getGoalAdjustedCalories } = require('../utils/calorieGoal');
  const goalTarget = getGoalAdjustedCalories({ bmr: user?.bmr, dailyCalories: user?.dailyCalories || targetCalories, fitnessGoal: goal });

  // Calorie share per meal slot (sums to 1.0)
  const slotBudgets = {
    breakfast: 0.20, mid_morning: 0.07, lunch: 0.27,
    evening_snack: 0.07, dinner: 0.25, pre_workout: 0.06, post_workout: 0.08,
  };

  // Pick the option closest to the slot's calorie budget.
  // Random among top-2 closest so "New Plan" still gives variety.
  const pickForBudget = (arr, budget) => {
    const sorted = [...arr].sort((a, b) => Math.abs(a.calories - budget) - Math.abs(b.calories - budget));
    const top = sorted.slice(0, Math.min(2, sorted.length));
    return top[Math.floor(Math.random() * top.length)];
  };

  const slots = [
    { type: 'breakfast', time: '8:00 AM' },
    { type: 'mid_morning', time: '10:30 AM' },
    { type: 'lunch', time: '1:00 PM' },
    { type: 'evening_snack', time: '4:30 PM' },
    { type: 'dinner', time: '8:00 PM' },
    { type: 'pre_workout', time: '6:00 AM' },
    { type: 'post_workout', time: '7:30 AM' },
  ];
  const meals = slots.map(s => ({
    ...s,
    items: [pickForBudget(mealSource[s.type] || [], Math.round(goalTarget * slotBudgets[s.type]))],
  }));

  // Greedy refinement: swap single items until plan total is within ±60 kcal of target
  for (let iter = 0; iter < 12; iter++) {
    const total = meals.reduce((s, m) => s + m.items[0].calories, 0);
    const gap = Math.abs(goalTarget - total);
    if (gap <= 60) break;
    let best = null;
    meals.forEach((m, mi) => {
      (mealSource[m.type] || []).forEach(opt => {
        const newTotal = total - m.items[0].calories + opt.calories;
        const newGap = Math.abs(goalTarget - newTotal);
        if (newGap < gap && (!best || newGap < best.gap)) best = { mi, opt, gap: newGap };
      });
    });
    if (!best) break;
    meals[best.mi].items = [best.opt];
  }

  // Calculate totals
  meals.forEach(m => {
    m.totalCalories = m.items.reduce((s, i) => s + i.calories, 0);
    m.totalProtein = m.items.reduce((s, i) => s + i.protein, 0);
  });

  const totalCaloriesPlan = meals.reduce((s, m) => s + m.totalCalories, 0);
  const totalProteinPlan = meals.reduce((s, m) => s + m.totalProtein, 0);

  const goalLabel = (goal === 'weight_loss' || goal === 'fat_loss') ? 'deficit'
    : (goal === 'weight_gain' || goal === 'muscle_building') ? 'surplus' : 'maintenance';
  const calAdjust = `Target: ${goalTarget} cal/day (${goalLabel})`;

  return {
    title: `${{ veg: 'Vegetarian', non_veg: 'Non-Veg', vegan: 'Vegan', eggetarian: 'Eggetarian' }[dietType] || 'Vegetarian'} ${goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Diet Plan`,
    goal, dietType,
    totalCalories: totalCaloriesPlan,
    totalProtein: totalProteinPlan,
    calorieNote: calAdjust,
    waterIntake: user?.weight ? Math.round(user.weight * 0.033 * 10) / 10 : 3,
    meals,
  };
}

module.exports = exports;
