const Achievement = require('../models/Achievement');
const Tracking = require('../models/Tracking');
const Workout = require('../models/Workout');
const ChatMessage = require('../models/ChatMessage');
const { BADGES } = require('../utils/badges');

// Tracking rows are stamped at IST midnight (see trackingController.getTodayIST),
// so a streak has to be measured against the same clock.
const todayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return ist;
};

const DAY_MS = 86400000;

/**
 * Consecutive days logged, counting back from today.
 *
 * The old version started at 1 and walked back from the newest row whatever its
 * date was, so somebody who logged three days in a row last March still showed
 * a live 3-day streak today, and "On Fire" stayed lit forever. A streak that
 * does not reach today or yesterday is over.
 */
const currentStreak = (dates) => {
  if (!dates.length) return 0;
  const today = todayIST().getTime();
  const day = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x.getTime();
  };
  // Yesterday still counts — today may simply not be logged yet.
  const gap = Math.round((today - day(dates[0])) / DAY_MS);
  if (gap > 1) return 0;

  let streak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    if (Math.round((day(dates[i]) - day(dates[i + 1])) / DAY_MS) === 1) streak++;
    else break;
  }
  return streak;
};

/**
 * One snapshot of everything the badges measure, gathered in a single pass.
 * The old code ran a query per badge inside the unlock loop — roughly thirty
 * round trips to answer a question this one set already answers.
 */
const collectStats = async (user) => {
  const userId = user.id || user._id;
  const [workouts, mealDays, chats, calorieDays, waterDays, topSteps, days] = await Promise.all([
    Workout.countDocuments({ user: userId }),
    Tracking.countDocuments({ user: userId, 'mealsLogged.0': { $exists: true } }),
    ChatMessage.countDocuments({ user: userId, sender: 'user' }),
    Tracking.countDocuments({ user: userId, caloriesConsumed: { $gt: 0 } }),
    Tracking.countDocuments({ user: userId, waterIntake: { $gte: 8 } }),
    Tracking.findOne({ user: userId }).sort({ steps: -1 }).select('steps'),
    Tracking.find({ user: userId }).sort({ date: -1 }).limit(400).select('date'),
  ]);

  return {
    workouts,
    mealDays,
    chats,
    calorieDays,
    waterDays,
    bestSteps: topSteps?.steps || 0,
    bestStreak: currentStreak(days.map((d) => d.date)),
    profileComplete: user.isProfileComplete === true,
    nearTargetWeight: !!(user.targetWeight && user.weight
      && Math.abs(user.weight - user.targetWeight) <= 2),
  };
};

/**
 * Unlock whatever the user now qualifies for. Safe to call from anywhere — it
 * only ever adds rows, and an upsert means two calls racing cannot collide on
 * the unique (user, type) index.
 */
const unlockFor = async (user) => {
  const userId = user.id || user._id;
  const [stats, already] = await Promise.all([
    collectStats(user),
    Achievement.find({ user: userId }).select('type'),
  ]);
  const have = new Set(already.map((a) => a.type));
  const unlocked = [];

  for (const badge of BADGES) {
    if (have.has(badge.type)) continue;
    if (badge.measure(stats) < badge.target) continue;
    try {
      const res = await Achievement.findOneAndUpdate(
        { user: userId, type: badge.type },
        {
          $setOnInsert: {
            user: userId, type: badge.type, title: badge.title,
            description: badge.description, icon: badge.icon, unlockedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      unlocked.push(res);
    } catch (e) {
      // One badge failing must not cost the user the rest of them — that is
      // exactly how a bad enum value used to wipe out the whole run.
      console.error(`Badge ${badge.type} could not be saved:`, e.message);
    }
  }
  return unlocked;
};

exports.unlockFor = unlockFor;

// @desc    Get user achievements, with live progress on the locked ones
exports.getAchievements = async (req, res, next) => {
  try {
    // Unlock first, so opening the screen never shows a full progress bar on a
    // badge that is still greyed out.
    await unlockFor(req.user);

    const [stats, earned] = await Promise.all([
      collectStats(req.user),
      Achievement.find({ user: req.user.id }).sort({ unlockedAt: -1 }),
    ]);
    const byType = new Map(earned.map((a) => [a.type, a]));

    const data = BADGES.map((badge) => {
      const got = byType.get(badge.type);
      const current = Math.min(badge.measure(stats), badge.target);
      return {
        type: badge.type,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        howTo: badge.howTo,
        isUnlocked: !!got,
        unlockedAt: got?.unlockedAt || null,
        progress: { current, target: badge.target },
        progressPercent: Math.round((current / badge.target) * 100),
      };
    });

    res.json({ success: true, unlocked: earned.length, total: BADGES.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Check and unlock achievements
exports.checkAchievements = async (req, res, next) => {
  try {
    const newlyUnlocked = await unlockFor(req.user);
    res.json({ success: true, newlyUnlocked: newlyUnlocked.length, data: newlyUnlocked });
  } catch (error) {
    next(error);
  }
};
