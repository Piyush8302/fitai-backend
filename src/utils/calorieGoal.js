// Single source of truth for the user's daily calorie target.
// Research-based (ICMR 2020, ACSM, ISSN):
//   - Loss: TDEE - 500, never below BMR (~0.5 kg/week)
//   - Gain: TDEE + 400 lean surplus | Muscle: TDEE + 300
exports.getGoalAdjustedCalories = (user) => {
  const bmr = user.bmr || 1500;
  const tdee = user.dailyCalories || 2000;
  const safeDeficit = Math.max(bmr, tdee - 500);
  const map = {
    weight_loss: safeDeficit,
    fat_loss: safeDeficit,
    weight_gain: Math.round(tdee + 400),
    muscle_building: Math.round(tdee + 300),
    height_growth: Math.round(tdee * 1.1),
    gym_workout: Math.round(tdee * 1.1),
    home_workout: tdee,
    maintenance: tdee,
  };
  return map[user.fitnessGoal] || tdee;
};
