// The badge catalogue — one definition per badge, used for BOTH the progress
// bar and the unlock decision.
//
// These were two separate lists before: a progress map in getAchievements and a
// switch in checkAchievements. They disagreed. `first_meal_log` counted
// `mealsLogged` for progress but `meals` (a field that does not exist) for
// unlocking, so it showed 1/1 and stayed locked forever. `steps_10k` had its
// progress hardcoded to 0. And four badges were missing from the model's enum
// entirely, so saving them threw — which aborted the whole unlock loop, taking
// every later badge with it.
//
// Now each badge says how to measure itself against a single stats snapshot,
// and both paths read that one number.

const BADGES = [
  {
    type: 'first_workout', title: 'First Step', icon: '💪',
    description: 'Create your first workout plan (1 workout)',
    howTo: 'Go to Workouts and create any plan',
    target: 1, measure: (s) => s.workouts,
  },
  {
    type: 'first_meal_log', title: 'Fuel Logger', icon: '🍽️',
    description: 'Log your first meal in tracking (1 meal)',
    howTo: 'Log a meal from Tracking or Diet screen',
    target: 1, measure: (s) => s.mealDays,
  },
  {
    type: 'chat_starter', title: 'Curious Mind', icon: '💬',
    description: 'Send your first message to AI assistant (1 chat)',
    howTo: 'Open AI Chat and ask any question',
    target: 1, measure: (s) => s.chats,
  },
  {
    type: 'profile_complete', title: 'Identity Set', icon: '✅',
    description: 'Complete your fitness profile with all details',
    howTo: 'Fill in gender, age, weight, height, goal in Profile Setup',
    target: 1, measure: (s) => (s.profileComplete ? 1 : 0),
  },
  {
    type: 'workout_count', title: 'Dedicated', icon: '🏋️',
    description: 'Create 10 workout plans (10 workouts)',
    howTo: 'Keep creating and following workout plans',
    target: 10, measure: (s) => s.workouts,
  },
  {
    type: 'hundred_workouts', title: 'Centurion', icon: '🏆',
    description: 'Create 100 workout plans (100 workouts)',
    howTo: 'Stay consistent with your training',
    target: 100, measure: (s) => s.workouts,
  },
  {
    type: 'water_goal', title: 'Hydration Hero', icon: '💧',
    description: 'Drink 8 glasses of water in a single day',
    howTo: 'Log 8 water glasses on any day',
    target: 1, measure: (s) => s.waterDays,
  },
  {
    type: 'five_water_days', title: 'Water Champion', icon: '🚰',
    description: 'Hit 8 glasses of water on 5 different days',
    howTo: 'Consistently hit your daily water goal',
    target: 5, measure: (s) => s.waterDays,
  },
  {
    type: 'streak', title: 'On Fire', icon: '🔥',
    description: 'Track your fitness for 3 consecutive days',
    howTo: 'Open the app and log something for 3 days in a row',
    target: 3, measure: (s) => s.bestStreak,
  },
  {
    type: 'seven_day_streak', title: 'Week Warrior', icon: '⚡',
    description: 'Maintain a 7-day tracking streak',
    howTo: 'Log activity every day for a full week',
    target: 7, measure: (s) => s.bestStreak,
  },
  {
    type: 'thirty_day_streak', title: 'Monthly Master', icon: '👑',
    description: 'Maintain a 30-day tracking streak',
    howTo: 'Log activity every day for a full month',
    target: 30, measure: (s) => s.bestStreak,
  },
  {
    type: 'weight_milestone', title: 'Goal Crusher', icon: '🎯',
    description: 'Reach within 2 kg of your target weight',
    howTo: 'Update your weight regularly as you progress',
    target: 1, measure: (s) => (s.nearTargetWeight ? 1 : 0),
  },
  {
    type: 'calorie_tracker', title: 'Calorie Counter', icon: '📊',
    description: 'Track your calories for 7 days total',
    howTo: 'Log meals or calories on 7 different days',
    target: 7, measure: (s) => s.calorieDays,
  },
  {
    type: 'ten_meals', title: 'Nutrition Pro', icon: '🥗',
    description: 'Log meals on 10 different days',
    howTo: 'Consistently log your meals from Diet or Tracking',
    target: 10, measure: (s) => s.mealDays,
  },
  {
    type: 'steps_10k', title: 'Step Master', icon: '👟',
    description: 'Walk 10,000 steps in a single day',
    howTo: 'Log a walk or run of 10,000 steps in one day',
    target: 10000, measure: (s) => s.bestSteps,
  },
];

// The model's enum is built from this list, so a badge added here can always be
// saved. Keeping the two in step by hand is what broke four of them.
const BADGE_TYPES = BADGES.map((b) => b.type);

module.exports = { BADGES, BADGE_TYPES };
