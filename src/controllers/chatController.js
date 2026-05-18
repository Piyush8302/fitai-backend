const ChatMessage = require('../models/ChatMessage');

// @desc    Send message to AI Health Assistant
exports.sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const user = req.user;

    // Save user message
    await ChatMessage.create({ user: user.id, role: 'user', message });

    // Generate AI response (rule-based smart coach)
    const aiResponse = generateSmartResponse(message, user);

    // Save AI response
    await ChatMessage.create({ user: user.id, role: 'assistant', message: aiResponse });

    res.json({ success: true, data: { reply: aiResponse } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chat history
exports.getChatHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await ChatMessage.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear chat history
exports.clearChat = async (req, res, next) => {
  try {
    await ChatMessage.deleteMany({ user: req.user.id });
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    next(error);
  }
};

// ---- Smart AI Response Generator ----
function generateSmartResponse(msg, user) {
  const m = msg.toLowerCase();
  const name = user.name || 'there';
  const weight = user.weight || 70;
  const goal = user.fitnessGoal || 'maintenance';
  const calories = user.dailyCalories || 2000;
  const protein = user.proteinNeed || Math.round(weight * 1.6);
  const bmi = user.bmi || 22;

  // Greeting
  if (m.match(/^(hi|hello|hey|namaste|hii)/)) {
    return `Hey ${name}! 💪 I'm your FitAI coach. Ask me anything about diet, workouts, weight loss, muscle gain, or health tips. How can I help you today?`;
  }

  // Weight loss
  if (m.includes('lose weight') || m.includes('weight loss') || m.includes('fat loss') || m.includes('belly fat') || m.includes('vajan kam')) {
    return `Here's your weight loss guide, ${name}:\n\n🔥 **Calorie Deficit**: Eat ${calories - 400} cal/day (400 less than your ${calories} maintenance)\n\n💪 **Workout Plan**:\n• 30 min cardio 5x/week (running, cycling, jumping)\n• Strength training 3x/week\n• 10,000+ steps daily\n\n🥗 **Diet Tips**:\n• High protein (${protein}g/day) - dal, paneer, eggs, chicken\n• Cut sugar & maida completely\n• Eat more fiber - veggies, salads, fruits\n• Drink 3-4L water daily\n• No eating after 8 PM\n\n⏰ **Intermittent Fasting**: Try 16:8 (eat between 12 PM - 8 PM)\n\nYou can lose 2-4 kg/month with this plan! Shall I create a detailed meal plan?`;
  }

  // Weight gain / muscle gain
  if (m.includes('gain weight') || m.includes('weight gain') || m.includes('bulk') || m.includes('mass') || m.includes('vajan badhana')) {
    return `Here's your weight gain plan, ${name}:\n\n📈 **Calorie Surplus**: Eat ${calories + 500} cal/day (500 more than your ${calories} maintenance)\n\n💪 **Workout Plan**:\n• Heavy compound lifts - Squats, Deadlifts, Bench Press\n• Progressive overload - increase weight every week\n• Train 5-6 days/week, 45-60 min sessions\n\n🥗 **Diet Plan**:\n• Protein: ${protein + 20}g/day minimum\n• Eat every 2-3 hours (6 meals/day)\n• Mass gainer shake: Banana + Oats + Milk + Peanut butter + Whey\n• Foods: Rice, Roti, Paneer, Chicken, Eggs, Nuts, Ghee\n• Pre-sleep: Milk + Turmeric\n\nGoal: Gain 2-3 kg/month of lean mass!`;
  }

  // Protein
  if (m.includes('protein') || m.includes('how much protein')) {
    return `Protein Guide for ${name}:\n\n📊 Your daily need: **${protein}g protein/day** (1.6g per kg body weight)\n\n🥗 **Veg Sources** (per 100g):\n• Paneer - 18g\n• Moong Dal - 24g\n• Chana - 19g\n• Soybean - 36g\n• Tofu - 17g\n• Greek Yogurt - 10g\n• Peanuts - 26g\n\n🍗 **Non-Veg Sources**:\n• Chicken breast - 31g\n• Eggs (1 whole) - 6g\n• Fish - 22g\n• Whey protein (1 scoop) - 24g\n\n⏰ **Timing**: Split into 4-5 meals. Have protein within 30 min post-workout.`;
  }

  // What to eat
  if (m.includes('what should i eat') || m.includes('kya khana') || m.includes('meal plan') || m.includes('diet plan')) {
    const goalMsg = goal === 'weight_loss' ? 'weight loss' : goal === 'weight_gain' ? 'weight gain' : 'healthy';
    return `Here's your ${goalMsg} meal plan, ${name}:\n\n🌅 **Breakfast (8 AM)**: Oats/Poha/Idli + Milk + 1 fruit\n🍌 **Mid-Morning (10:30 AM)**: Banana + Almonds/Sprouts\n🍛 **Lunch (1 PM)**: 2 Roti + Dal + Sabzi + Salad + Curd\n☕ **Evening (4:30 PM)**: Green tea + Makhana/Chana\n🍽️ **Dinner (7:30 PM)**: 1 Roti + Light Sabzi + Soup\n💤 **Bedtime**: Warm milk + Turmeric\n\n💧 Water: ${Math.round(weight * 0.033)} liters/day\n📊 Total: ~${calories} calories\n\nWant me to customize this further?`;
  }

  // Best exercises for chest
  if (m.includes('chest') || m.includes('chest exercise')) {
    return `Best Chest Exercises 💪:\n\n🏠 **Home**:\n1. Push-ups (3x15) - Classic, targets full chest\n2. Wide Push-ups (3x12) - Outer chest\n3. Diamond Push-ups (3x10) - Inner chest\n4. Decline Push-ups (3x12) - Upper chest\n\n🏋️ **Gym**:\n1. Flat Bench Press (4x8) - Main mass builder\n2. Incline Dumbbell Press (3x10) - Upper chest\n3. Cable Flyes (3x12) - Inner chest definition\n4. Dips (3x12) - Lower chest\n\n⚡ **Tips**:\n• Squeeze chest at the top\n• Control the negative (lowering)\n• Progressive overload every week\n• Rest 60-90 sec between sets`;
  }

  // Height
  if (m.includes('height') || m.includes('height grow') || m.includes('taller') || m.includes('lambai')) {
    return `Height Growth Guide, ${name}:\n\n⚠️ **Science Says**: Height is 60-80% genetic. After 18-20 (for most), growth plates close. BUT you can maximize your potential:\n\n🧘 **Exercises**:\n1. Hanging (2 min daily) - Decompresses spine\n2. Cobra Stretch - Stretches spine\n3. Swimming - Full body stretch\n4. Skipping - Stimulates growth\n5. Toe touches - Flexibility\n\n🥗 **Nutrition**:\n• Calcium: Milk, Curd, Paneer\n• Vitamin D: Sunlight 15 min daily\n• Protein: For growth hormone\n• Zinc: Nuts, seeds\n\n😴 **Sleep**: 7-9 hours (growth hormone releases during deep sleep)\n\n🧍 **Posture**: Fix your posture to appear 1-2 inches taller instantly!\n\nConsistency is key! Results show in 3-6 months.`;
  }

  // Sleep
  if (m.includes('sleep') || m.includes('neend') || m.includes('insomnia')) {
    return `Sleep Better Guide 😴:\n\n⏰ **Ideal Sleep**: 7-9 hours for adults\n\n📋 **Tips**:\n1. Fixed schedule - Same time daily\n2. No screen 1 hour before bed\n3. Room temperature: 18-22°C\n4. No caffeine after 4 PM\n5. Light dinner before 8 PM\n6. 10 min meditation before sleep\n7. Dark room + No noise\n\n🍵 **Helps**:\n• Warm milk + turmeric\n• Chamomile tea\n• Magnesium-rich foods (bananas, almonds)\n\n💪 **Why it matters**: Growth hormone releases during sleep. Bad sleep = slow muscle recovery + weight gain.`;
  }

  // Water
  if (m.includes('water') || m.includes('pani') || m.includes('hydration')) {
    return `Hydration Guide 💧:\n\n📊 Your need: **${Math.round(weight * 0.033)} liters/day** (based on your ${weight}kg weight)\n\n⏰ **Schedule**:\n• Wake up: 2 glasses (warm + lemon)\n• Before meals: 1 glass (30 min before)\n• During workout: Sip every 15 min\n• Evening: 2-3 glasses\n• Before bed: 1 glass\n\n✅ **Benefits**: Better digestion, glowing skin, more energy, weight loss, toxin flush\n\n⚠️ **Signs of dehydration**: Dark urine, headache, fatigue, dry lips`;
  }

  // Best time to eat
  if (m.includes('best time') || m.includes('kab khana') || m.includes('meal timing')) {
    return `Optimal Meal Timing ⏰:\n\n🌅 6:30 AM - Warm water + Lemon\n🥣 8:00 AM - Breakfast (biggest meal)\n🍌 10:30 AM - Mid-morning snack\n🍛 1:00 PM - Lunch\n☕ 4:00 PM - Evening snack\n🏋️ 5:30 PM - Pre-workout snack\n💪 7:00 PM - Post-workout meal\n🍽️ 8:00 PM - Light dinner\n🥛 9:30 PM - Warm milk\n\n📌 **Rules**:\n• Eat within 1 hour of waking\n• No heavy food after 8 PM\n• 30 min gap between water & food\n• Post-workout meal within 30 min`;
  }

  // BMI
  if (m.includes('bmi') || m.includes('body mass')) {
    const category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    return `Your BMI Analysis 📊:\n\n📏 BMI: **${bmi}** (${category})\n\n📋 **BMI Scale**:\n• Under 18.5 = Underweight\n• 18.5 - 24.9 = Normal ✅\n• 25 - 29.9 = Overweight\n• 30+ = Obese\n\n${category === 'Normal' ? '✅ Great! You\'re in a healthy range. Focus on maintaining!' : category === 'Underweight' ? '⬆️ Focus on calorie surplus + strength training' : '⬇️ Focus on calorie deficit + cardio + clean eating'}\n\nUse our BMI Calculator for detailed analysis!`;
  }

  // Default
  return `Great question, ${name}! 🤔\n\nHere are some quick health tips:\n\n1. 💧 Drink ${Math.round(weight * 0.033)}L water daily\n2. 🥗 Eat ${protein}g protein daily\n3. 🏃 Exercise 30-45 min daily\n4. 😴 Sleep 7-8 hours\n5. 🧘 Practice 10 min meditation\n\nAsk me about:\n• Diet plans\n• Workout routines\n• Weight loss/gain tips\n• Specific exercises\n• Nutrition advice\n• Height growth\n• Sleep improvement\n\nI'm here to help! 💪`;
}

module.exports = exports;
