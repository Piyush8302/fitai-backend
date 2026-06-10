const User = require('../models/User');

// @desc    Calculate BMI & body analysis
exports.calculateBMI = async (req, res, next) => {
  try {
    const { height, weight, age, gender } = req.body;

    if (!height || !weight) {
      return res.status(400).json({ success: false, message: 'Height and weight are required' });
    }

    // Fallback to the logged-in user's saved profile so numbers stay
    // consistent with profile/tracking (single source of truth)
    const userAge = age || req.user?.age || 25;
    const userGender = gender || req.user?.gender || 'male';

    const heightM = height / 100;
    const bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));

    // BMI Category
    let category, color;
    if (bmi < 18.5) { category = 'Underweight'; color = '#FFA726'; }
    else if (bmi < 25) { category = 'Normal'; color = '#66BB6A'; }
    else if (bmi < 30) { category = 'Overweight'; color = '#FFA726'; }
    else { category = 'Obese'; color = '#EF5350'; }

    // BMR (Mifflin-St Jeor) — same formula as User pre-save hook
    let bmr;
    if (userGender === 'male') {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * userAge + 5);
    } else {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * userAge - 161);
    }

    // Body fat estimation (US Navy method simplified)
    let bodyFat;
    if (userGender === 'male') {
      bodyFat = parseFloat((1.20 * bmi + 0.23 * userAge - 16.2).toFixed(1));
    } else {
      bodyFat = parseFloat((1.20 * bmi + 0.23 * userAge - 5.4).toFixed(1));
    }
    bodyFat = Math.max(5, Math.min(50, bodyFat));

    // Healthy weight range
    const healthyMin = parseFloat((18.5 * heightM * heightM).toFixed(1));
    const healthyMax = parseFloat((24.9 * heightM * heightM).toFixed(1));

    // Daily calorie needs — use the user's real activity level (same map as User model)
    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extra_active: 1.9 };
    const activityMultiplier = multipliers[req.user?.activityLevel] || 1.55;
    const dailyCalories = Math.round(bmr * activityMultiplier);

    // Protein need
    const proteinNeed = Math.round(weight * 1.6);

    // Weight prediction (4 weeks)
    let weeklyChange = 0;
    if (category === 'Overweight' || category === 'Obese') weeklyChange = -0.5;
    else if (category === 'Underweight') weeklyChange = 0.3;
    const predictedWeight = parseFloat((weight + weeklyChange * 4).toFixed(1));

    // Suggestions
    const suggestions = [];
    if (bmi < 18.5) {
      suggestions.push('Increase calorie intake by 300-500 calories/day');
      suggestions.push('Focus on protein-rich foods and strength training');
      suggestions.push('Eat frequent small meals throughout the day');
    } else if (bmi >= 25) {
      suggestions.push('Create a calorie deficit of 300-500 calories/day');
      suggestions.push('Include 30 min of cardio 5 days a week');
      suggestions.push('Reduce sugar and processed food intake');
    } else {
      suggestions.push('Maintain your current balanced diet');
      suggestions.push('Stay active with regular exercise');
      suggestions.push('Focus on strength training for muscle tone');
    }

    // Update user via save() so the pre-save hook recalculates
    // BMI/BMR/dailyCalories consistently with profile updates
    if (req.user) {
      const userDoc = await User.findById(req.user.id);
      if (userDoc) {
        userDoc.height = height;
        userDoc.weight = weight;
        if (age) userDoc.age = age;
        if (gender) userDoc.gender = gender;
        await userDoc.save();
      }
    }

    res.json({
      success: true,
      data: {
        bmi, category, color, bmr, bodyFat,
        dailyCalories, proteinNeed,
        healthyWeightRange: { min: healthyMin, max: healthyMax },
        predictedWeight4Weeks: predictedWeight,
        metabolism: bmr > 1500 ? 'Fast' : bmr > 1200 ? 'Normal' : 'Slow',
        suggestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get BMI history
exports.getBMIHistory = async (req, res, next) => {
  try {
    const Tracking = require('../models/Tracking');
    const records = await Tracking.find({ user: req.user.id, weight: { $exists: true, $ne: null } })
      .sort({ date: -1 }).limit(30).select('date weight');

    const user = await User.findById(req.user.id).select('height');
    const history = records.map(r => {
      const heightM = (user.height || 170) / 100;
      return {
        date: r.date,
        weight: r.weight,
        bmi: parseFloat((r.weight / (heightM * heightM)).toFixed(1)),
      };
    });

    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};
