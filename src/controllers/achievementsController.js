const Achievement = require('../models/Achievement');
const Tracking = require('../models/Tracking');
const Workout = require('../models/Workout');
const ChatMessage = require('../models/ChatMessage');

// @desc    Get user achievements
exports.getAchievements = async (req, res, next) => {
  try {
    const achievements = await Achievement.find({ user: req.user.id }).sort({ unlockedAt: -1 });

    // Also return locked achievements the user hasn't unlocked yet
    const unlockedTypes = achievements.map(a => a.type);
    const allAchievements = ALL_ACHIEVEMENTS.map(a => {
      const unlocked = achievements.find(u => u.type === a.type);
      return {
        ...a,
        isUnlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt || null,
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

const ALL_ACHIEVEMENTS = [
  { type: 'first_workout', title: 'First Step', description: 'Created your first workout plan', icon: '💪' },
  { type: 'first_meal_log', title: 'Fuel Logger', description: 'Logged your first meal', icon: '🍽️' },
  { type: 'chat_starter', title: 'Curious Mind', description: 'Asked your first question to AI assistant', icon: '💬' },
  { type: 'profile_complete', title: 'Identity Set', description: 'Completed your fitness profile', icon: '✅' },
  { type: 'workout_count', title: 'Dedicated', description: 'Created 10 workout plans', icon: '🏋️' },
  { type: 'hundred_workouts', title: 'Centurion', description: 'Created 100 workout plans', icon: '🏆' },
  { type: 'water_goal', title: 'Hydration Hero', description: 'Hit 8 glasses of water in a day', icon: '💧' },
  { type: 'streak', title: 'On Fire', description: 'Tracked 3 days in a row', icon: '🔥' },
  { type: 'seven_day_streak', title: 'Week Warrior', description: '7-day tracking streak', icon: '⚡' },
  { type: 'thirty_day_streak', title: 'Monthly Master', description: '30-day tracking streak', icon: '👑' },
  { type: 'weight_milestone', title: 'Goal Crusher', description: 'Reached within 2kg of your target weight', icon: '🎯' },
];
