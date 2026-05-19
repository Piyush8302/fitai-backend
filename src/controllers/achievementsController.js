const Achievement = require('../models/Achievement');
const Tracking = require('../models/Tracking');
const Workout = require('../models/Workout');
const ChatMessage = require('../models/ChatMessage');

// @desc    Get user achievements
exports.getAchievements = async (req, res, next) => {
  try {
    const achievements = await Achievement.find({ user: req.user.id }).sort({ unlockedAt: -1 });

    const unlockedTypes = achievements.map(a => a.type);

    // Build progress for each achievement
    const userId = req.user.id;
    const [workoutCount, mealCount, chatCount, trackingDays, waterDays, currentStreak] = await Promise.all([
      Workout.countDocuments({ user: userId }),
      Tracking.countDocuments({ user: userId, 'mealsLogged.0': { $exists: true } }),
      ChatMessage.countDocuments({ user: userId, sender: 'user' }),
      Tracking.countDocuments({ user: userId }),
      Tracking.countDocuments({ user: userId, waterIntake: { $gte: 8 } }),
      getStreak(userId),
    ]);

    const progressMap = {
      first_workout: { current: Math.min(workoutCount, 1), target: 1 },
      first_meal_log: { current: Math.min(mealCount, 1), target: 1 },
      chat_starter: { current: Math.min(chatCount, 1), target: 1 },
      profile_complete: { current: req.user.isProfileComplete ? 1 : 0, target: 1 },
      workout_count: { current: Math.min(workoutCount, 10), target: 10 },
      hundred_workouts: { current: Math.min(workoutCount, 100), target: 100 },
      water_goal: { current: Math.min(waterDays, 1), target: 1 },
      five_water_days: { current: Math.min(waterDays, 5), target: 5 },
      streak: { current: Math.min(currentStreak, 3), target: 3 },
      seven_day_streak: { current: Math.min(currentStreak, 7), target: 7 },
      thirty_day_streak: { current: Math.min(currentStreak, 30), target: 30 },
      weight_milestone: { current: req.user.targetWeight && req.user.weight ? (Math.abs(req.user.weight - req.user.targetWeight) <= 2 ? 1 : 0) : 0, target: 1 },
      calorie_tracker: { current: Math.min(trackingDays, 7), target: 7 },
      ten_meals: { current: Math.min(mealCount, 10), target: 10 },
      steps_10k: { current: 0, target: 1 },
    };

    const allAchievements = ALL_ACHIEVEMENTS.map(a => {
      const unlocked = achievements.find(u => u.type === a.type);
      const progress = progressMap[a.type] || { current: 0, target: 1 };
      return {
        ...a,
        isUnlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt || null,
        progress,
        progressPercent: Math.round((progress.current / progress.target) * 100),
      };
    });

    res.json({ success: true, unlocked: achievements.length, total: ALL_ACHIEVEMENTS.length, data: allAchievements });
  } catch (error) {
    next(error);
  }
};

// @desc    Check and unlock achievements (called internally or by endpoint)
exports.checkAchievements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const newlyUnlocked = [];

    // Check each achievement
    for (const ach of ALL_ACHIEVEMENTS) {
      const exists = await Achievement.findOne({ user: userId, type: ach.type });
      if (exists) continue;

      let qualified = false;

      switch (ach.type) {
        case 'first_workout': {
          const count = await Workout.countDocuments({ user: userId });
          qualified = count >= 1;
          break;
        }
        case 'first_meal_log': {
          const count = await Tracking.countDocuments({ user: userId, 'meals.0': { $exists: true } });
          qualified = count >= 1;
          break;
        }
        case 'chat_starter': {
          const count = await ChatMessage.countDocuments({ user: userId, sender: 'user' });
          qualified = count >= 1;
          break;
        }
        case 'profile_complete': {
          qualified = req.user.isProfileComplete === true;
          break;
        }
        case 'workout_count': {
          const count = await Workout.countDocuments({ user: userId });
          qualified = count >= 10;
          break;
        }
        case 'hundred_workouts': {
          const count = await Workout.countDocuments({ user: userId });
          qualified = count >= 100;
          break;
        }
        case 'water_goal': {
          const tracking = await Tracking.findOne({ user: userId, waterIntake: { $gte: 8 } });
          qualified = !!tracking;
          break;
        }
        case 'streak': {
          qualified = await checkStreak(userId, 3);
          break;
        }
        case 'seven_day_streak': {
          qualified = await checkStreak(userId, 7);
          break;
        }
        case 'thirty_day_streak': {
          qualified = await checkStreak(userId, 30);
          break;
        }
        case 'weight_milestone': {
          if (req.user.targetWeight && req.user.weight) {
            qualified = Math.abs(req.user.weight - req.user.targetWeight) <= 2;
          }
          break;
        }
        case 'five_water_days': {
          const waterDaysCount = await Tracking.countDocuments({ user: userId, waterIntake: { $gte: 8 } });
          qualified = waterDaysCount >= 5;
          break;
        }
        case 'calorie_tracker': {
          const trackCount = await Tracking.countDocuments({ user: userId, caloriesConsumed: { $gt: 0 } });
          qualified = trackCount >= 7;
          break;
        }
        case 'ten_meals': {
          const mealDays = await Tracking.countDocuments({ user: userId, 'mealsLogged.0': { $exists: true } });
          qualified = mealDays >= 10;
          break;
        }
        case 'steps_10k': {
          const stepDay = await Tracking.findOne({ user: userId, steps: { $gte: 10000 } });
          qualified = !!stepDay;
          break;
        }
        default:
          break;
      }

      if (qualified) {
        const newAch = await Achievement.create({
          user: userId,
          type: ach.type,
          title: ach.title,
          description: ach.description,
          icon: ach.icon,
        });
        newlyUnlocked.push(newAch);
      }
    }

    if (next && res) {
      res.json({ success: true, newlyUnlocked: newlyUnlocked.length, data: newlyUnlocked });
    }
    return newlyUnlocked;
  } catch (error) {
    if (next) next(error);
  }
};

async function checkStreak(userId, days) {
  const records = await Tracking.find({ user: userId })
    .sort({ date: -1 })
    .limit(days)
    .select('date');

  if (records.length < days) return false;

  for (let i = 0; i < days - 1; i++) {
    const curr = new Date(records[i].date);
    const prev = new Date(records[i + 1].date);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays !== 1) return false;
  }
  return true;
}

async function getStreak(userId) {
  const records = await Tracking.find({ user: userId })
    .sort({ date: -1 })
    .limit(60)
    .select('date');

  if (records.length === 0) return 0;

  let streak = 1;
  for (let i = 0; i < records.length - 1; i++) {
    const curr = new Date(records[i].date);
    const prev = new Date(records[i + 1].date);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

const ALL_ACHIEVEMENTS = [
  { type: 'first_workout', title: 'First Step', description: 'Create your first workout plan (1 workout)', icon: '💪', howTo: 'Go to Workouts and create any plan' },
  { type: 'first_meal_log', title: 'Fuel Logger', description: 'Log your first meal in tracking (1 meal)', icon: '🍽️', howTo: 'Log a meal from Tracking or Diet screen' },
  { type: 'chat_starter', title: 'Curious Mind', description: 'Send your first message to AI assistant (1 chat)', icon: '💬', howTo: 'Open AI Chat and ask any question' },
  { type: 'profile_complete', title: 'Identity Set', description: 'Complete your fitness profile with all details', icon: '✅', howTo: 'Fill in gender, age, weight, height, goal in Profile Setup' },
  { type: 'workout_count', title: 'Dedicated', description: 'Create 10 workout plans (10 workouts)', icon: '🏋️', howTo: 'Keep creating and following workout plans' },
  { type: 'hundred_workouts', title: 'Centurion', description: 'Create 100 workout plans (100 workouts)', icon: '🏆', howTo: 'Stay consistent with your training' },
  { type: 'water_goal', title: 'Hydration Hero', description: 'Drink 8 glasses of water in a single day', icon: '💧', howTo: 'Log 8 water glasses on any day' },
  { type: 'five_water_days', title: 'Water Champion', description: 'Hit 8 glasses of water on 5 different days', icon: '🚰', howTo: 'Consistently hit your daily water goal' },
  { type: 'streak', title: 'On Fire', description: 'Track your fitness for 3 consecutive days', icon: '🔥', howTo: 'Open the app and log something for 3 days in a row' },
  { type: 'seven_day_streak', title: 'Week Warrior', description: 'Maintain a 7-day tracking streak', icon: '⚡', howTo: 'Log activity every day for a full week' },
  { type: 'thirty_day_streak', title: 'Monthly Master', description: 'Maintain a 30-day tracking streak', icon: '👑', howTo: 'Log activity every day for a full month' },
  { type: 'weight_milestone', title: 'Goal Crusher', description: 'Reach within 2 kg of your target weight', icon: '🎯', howTo: 'Update your weight regularly as you progress' },
  { type: 'calorie_tracker', title: 'Calorie Counter', description: 'Track your calories for 7 days total', icon: '📊', howTo: 'Log meals or calories on 7 different days' },
  { type: 'ten_meals', title: 'Nutrition Pro', description: 'Log meals on 10 different days', icon: '🥗', howTo: 'Consistently log your meals from Diet or Tracking' },
  { type: 'steps_10k', title: 'Step Master', description: 'Walk 10,000 steps in a single day', icon: '👟', howTo: 'Enable step counter and walk 10,000 steps' },
];
