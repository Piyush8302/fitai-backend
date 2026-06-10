const ChatMessage = require('../models/ChatMessage');
const { getGoalAdjustedCalories } = require('../utils/calorieGoal');

// AI integration (Groq / Gemini)
const callAI = async (message, user, context) => {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) return null;

  const name = user.name?.split(' ')[0] || 'User';
  const systemPrompt = `You are FitAI, a friendly and knowledgeable AI fitness & health coach inside a fitness app.

User profile:
- Name: ${name}
- Age: ${user.age || 'unknown'}, Gender: ${user.gender || 'unknown'}
- Weight: ${user.weight || 'unknown'}kg, Height: ${user.height || 'unknown'}cm
- BMI: ${user.bmi || 'unknown'}, BMR: ${user.bmr || 'unknown'} cal
- Daily calories target: ${getGoalAdjustedCalories(user)} cal (goal-adjusted — always quote THIS number for their daily target)
- Protein need: ${user.proteinNeed || Math.round((user.weight || 70) * 1.6)}g
- Fitness goal: ${user.fitnessGoal || 'general fitness'}
- Diet preference: ${user.dietPreference || 'no preference'}
- Activity level: ${user.activityLevel || 'moderate'}

Rules:
- Give personalized advice based on the user's profile above
- Be concise (max 200 words), use bullet points and emojis
- Focus on Indian context (Indian foods, exercises suitable for Indian lifestyle) when relevant
- For diet plans, use Indian foods (roti, dal, paneer, rice, etc.) unless user asks for international
- Always be encouraging and motivational
- If asked non-health topics, politely redirect to fitness/health
- Use the user's name naturally in responses
- Give specific numbers (calories, protein, sets, reps) when possible`;

  // Build messages array (OpenAI format - works for Groq)
  const messages = [{ role: 'system', content: systemPrompt }];
  context.forEach(c => {
    messages.push({ role: c.role === 'assistant' ? 'assistant' : 'user', content: c.message });
  });
  messages.push({ role: 'user', content: message });

  // Try Groq first (fast, free)
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      const data = await response.json();
      console.log('Groq status:', response.status);
      if (response.ok && data.choices?.[0]?.message?.content) {
        console.log('Using Groq AI response');
        return data.choices[0].message.content;
      }
      console.error('Groq error:', JSON.stringify(data?.error || data));
    } catch (err) {
      console.error('Groq API error:', err.message);
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    try {
      const contents = [];
      context.forEach(c => {
        contents.push({ role: c.role === 'assistant' ? 'model' : 'user', parts: [{ text: c.message }] });
      });
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      );
      const data = await response.json();
      console.log('Gemini status:', response.status);
      if (response.ok) {
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) { console.log('Using Gemini AI response'); return reply; }
      }
      console.error('Gemini error:', JSON.stringify(data?.error || data));
    } catch (err) {
      console.error('Gemini API error:', err.message);
    }
  }

  return null;
};

const FREE_DAILY_LIMIT = 10;

// @desc    Send message to AI Health Assistant
exports.sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const User = require('../models/User');
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];

    // Check if premium expired
    if (user.isPremium && user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date()) {
      await User.findByIdAndUpdate(user.id, { isPremium: false, subscriptionPlan: 'free' });
      user.isPremium = false;
    }

    // Reset daily count if new day
    let chatCount = user.dailyChatCount || 0;
    if (user.lastChatDate !== todayStr) chatCount = 0;

    // Check daily limit for free users
    if (!user.isPremium && chatCount >= FREE_DAILY_LIMIT) {
      return res.json({
        success: false,
        limitReached: true,
        remaining: 0,
        limit: FREE_DAILY_LIMIT,
        message: `You've used all ${FREE_DAILY_LIMIT} free messages today. Upgrade to Premium for unlimited AI chat!`,
      });
    }

    // Increment chat count
    chatCount += 1;
    await User.findByIdAndUpdate(user.id, { dailyChatCount: chatCount, lastChatDate: todayStr });

    // Get last 6 messages for context
    const recentMessages = await ChatMessage.find({ user: user.id })
      .sort({ createdAt: -1 }).limit(6);
    const context = recentMessages.reverse().map(m => ({ role: m.role, message: m.message }));

    await ChatMessage.create({ user: user.id, role: 'user', message });

    // Try AI API first (Groq/Gemini), fallback to rule-based
    let aiResponse = await callAI(message, user, context);
    if (!aiResponse) {
      console.log('AI API failed, using rule-based fallback');
      aiResponse = generateSmartResponse(message, user, context);
    }

    await ChatMessage.create({ user: user.id, role: 'assistant', message: aiResponse });

    const remaining = user.isPremium ? -1 : Math.max(0, FREE_DAILY_LIMIT - chatCount);
    res.json({ success: true, data: { reply: aiResponse, remaining, isPremium: user.isPremium || false } });
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

// @desc    Get quick suggestions based on user profile
exports.getSuggestions = async (req, res, next) => {
  try {
    const user = req.user;
    const goal = user.fitnessGoal || 'maintenance';
    const suggestions = [];

    if (goal === 'weight_loss' || goal === 'fat_loss') {
      suggestions.push('How to lose belly fat fast?', 'Best fat burning exercises', 'Indian diet plan for weight loss', 'How many calories should I eat?', 'Intermittent fasting guide', 'Best cardio for fat loss');
    } else if (goal === 'weight_gain' || goal === 'muscle_building') {
      suggestions.push('How to gain muscle mass?', 'Best protein sources in India', 'Mass gainer shake recipe', 'Gym workout plan for beginners', 'How much protein do I need?', 'Best exercises for chest');
    } else {
      suggestions.push('Healthy Indian meal plan', 'Home workout routine', 'How to improve sleep?', 'Benefits of drinking water', 'Yoga for beginners', 'How to reduce stress?');
    }

    suggestions.push('What is my BMI?', 'Tips for better sleep', 'How to stay motivated?', 'Benefits of meditation');

    res.json({ success: true, data: suggestions.slice(0, 10) });
  } catch (error) {
    next(error);
  }
};

// ==================== SMART AI RESPONSE ENGINE ====================

function generateSmartResponse(msg, user, context) {
  const m = msg.toLowerCase().trim();
  const name = user.name?.split(' ')[0] || 'there';
  const weight = user.weight || 70;
  const height = user.height || 170;
  const goal = user.fitnessGoal || 'maintenance';
  const calories = getGoalAdjustedCalories(user);
  const protein = user.proteinNeed || Math.round(weight * 1.6);
  const bmi = user.bmi || parseFloat((weight / ((height / 100) ** 2)).toFixed(1));
  const gender = user.gender || 'male';
  const age = user.age || 25;
  const dietPref = user.dietPreference || 'veg';
  const waterNeed = Math.round(weight * 0.033 * 10) / 10;
  const bmr = user.bmr || Math.round(10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161));

  // Detect intent from message
  const intent = detectIntent(m);

  // Check if this is a follow-up
  const lastBotMsg = context.filter(c => c.role === 'assistant').pop();
  if (isFollowUp(m, lastBotMsg)) {
    return handleFollowUp(m, lastBotMsg, { name, weight, height, goal, calories, protein, bmi, gender, age, dietPref, waterNeed, bmr });
  }

  // Route to appropriate handler
  switch (intent) {
    case 'greeting': return handleGreeting(name, goal);
    case 'weight_loss': return handleWeightLoss(name, calories, protein, weight, bmi, dietPref);
    case 'weight_gain': return handleWeightGain(name, calories, protein, weight, dietPref);
    case 'muscle_building': return handleMuscleBuilding(name, protein, calories, weight, dietPref);
    case 'protein': return handleProtein(name, protein, weight, dietPref);
    case 'diet_plan': return handleDietPlan(name, goal, calories, dietPref, weight);
    case 'indian_diet': return handleIndianDiet(name, goal, calories, dietPref);
    case 'international_diet': return handleInternationalDiet(name, goal, calories);
    case 'keto': return handleKetoDiet(name, calories, weight, dietPref);
    case 'intermittent_fasting': return handleIntermittentFasting(name, weight, goal);
    case 'calories': return handleCalories(name, calories, bmr, goal, weight);
    case 'chest': return handleChestWorkout(name);
    case 'back': return handleBackWorkout(name);
    case 'legs': return handleLegsWorkout(name);
    case 'arms': return handleArmsWorkout(name);
    case 'shoulders': return handleShouldersWorkout(name);
    case 'abs': return handleAbsWorkout(name);
    case 'cardio': return handleCardio(name, weight, goal);
    case 'home_workout': return handleHomeWorkout(name, goal);
    case 'gym_workout': return handleGymWorkout(name, goal);
    case 'yoga': return handleYoga(name);
    case 'stretching': return handleStretching(name);
    case 'height': return handleHeight(name, age);
    case 'sleep': return handleSleep(name);
    case 'water': return handleWater(name, weight, waterNeed);
    case 'bmi': return handleBMI(name, bmi, weight, height);
    case 'supplements': return handleSupplements(name, goal, dietPref);
    case 'creatine': return handleCreatine(name, weight);
    case 'whey': return handleWheyProtein(name, protein, dietPref);
    case 'meal_timing': return handleMealTiming(name, goal);
    case 'pre_workout': return handlePreWorkout(name);
    case 'post_workout': return handlePostWorkout(name, protein, dietPref);
    case 'skin': return handleSkinHealth(name);
    case 'hair': return handleHairHealth(name, dietPref);
    case 'digestion': return handleDigestion(name);
    case 'immunity': return handleImmunity(name, dietPref);
    case 'stress': return handleStress(name);
    case 'meditation': return handleMeditation(name);
    case 'diabetes': return handleDiabetes(name, dietPref);
    case 'thyroid': return handleThyroid(name, gender);
    case 'pcos': return handlePCOS(name);
    case 'heart': return handleHeartHealth(name, bmi);
    case 'back_pain': return handleBackPain(name);
    case 'knee_pain': return handleKneePain(name);
    case 'pregnancy': return handlePregnancyFitness(name);
    case 'vegetarian_protein': return handleVegProtein(name, protein);
    case 'egg': return handleEggNutrition(name);
    case 'milk': return handleMilkBenefits(name);
    case 'ayurveda': return handleAyurveda(name);
    case 'home_remedies': return handleHomeRemedies(name);
    case 'detox': return handleDetox(name, weight);
    case 'energy': return handleEnergy(name);
    case 'motivation': return handleMotivation(name, goal);
    case 'plateau': return handlePlateau(name, goal);
    case 'cheat_meal': return handleCheatMeal(name, goal);
    case 'alcohol': return handleAlcohol(name, goal);
    case 'sugar': return handleSugar(name);
    case 'rice': return handleRiceMyth(name, goal);
    case 'ghee': return handleGheeBenefits(name);
    case 'paneer': return handlePaneerNutrition(name);
    case 'chicken': return handleChickenNutrition(name);
    case 'oats': return handleOatsRecipes(name);
    case 'smoothie': return handleSmoothieRecipes(name, goal, dietPref);
    case 'six_pack': return handleSixPack(name, bmi);
    case 'running': return handleRunning(name, weight);
    case 'walking': return handleWalking(name, weight);
    case 'swimming': return handleSwimming(name);
    case 'cycling': return handleCycling(name, weight);
    case 'warm_up': return handleWarmUp(name);
    case 'cool_down': return handleCoolDown(name);
    case 'injury': return handleInjuryPrevention(name);
    case 'body_type': return handleBodyType(name, bmi, weight, height);
    case 'metabolism': return handleMetabolism(name, bmr, age);
    case 'thank_you': return handleThankYou(name);
    case 'goodbye': return handleGoodbye(name);
    case 'who_are_you': return handleWhoAreYou(name);
    case 'help': return handleHelp(name);
    default: return handleDefault(name, weight, protein, goal);
  }
}

// ==================== INTENT DETECTION ====================

function detectIntent(m) {
  const patterns = [
    { intent: 'greeting', words: [/^(hi|hello|hey|namaste|hii|hola|yo|sup|good morning|good evening|gm|gn)/] },
    { intent: 'thank_you', words: [/^(thanks|thank you|thanku|thnx|shukriya|dhanyavad)/] },
    { intent: 'goodbye', words: [/^(bye|goodbye|see you|alvida|tata|good night)/] },
    { intent: 'who_are_you', words: [/who are you|what are you|what can you do|kya kar sakte/] },
    { intent: 'help', words: [/^help$|help me|madad|sahayata/] },
    { intent: 'weight_loss', words: [/lose weight|weight loss|fat loss|belly fat|vajan kam|wazan kam|pet kam|slim|patla|reduce weight|fat burn|lose fat|mota|motapa/] },
    { intent: 'weight_gain', words: [/gain weight|weight gain|bulk|mass gain|vajan badhana|wazan badhana|patla hu|skinny|underweight|dubla|weight kaise badhaye/] },
    { intent: 'muscle_building', words: [/muscle|body building|body banani|muscular|lean body|ripped|shredded|mass build|muscle kaise banaye/] },
    { intent: 'protein', words: [/how much protein|protein need|protein intake|protein kitna|daily protein|protein requirement/] },
    { intent: 'vegetarian_protein', words: [/veg protein|vegetarian protein|protein without meat|plant protein|shakahari protein/] },
    { intent: 'indian_diet', words: [/indian diet|desi diet|indian meal|desi khana|indian food plan|bharatiya|hindi diet/] },
    { intent: 'international_diet', words: [/international diet|mediterranean|western diet|global diet|foreign diet|american diet|european diet/] },
    { intent: 'keto', words: [/keto|ketogenic|low carb diet|no carb/] },
    { intent: 'intermittent_fasting', words: [/intermittent fasting|fasting|16.8|18.6|if diet|vrat|upwas|fast/] },
    { intent: 'diet_plan', words: [/what should i eat|kya khana|meal plan|diet plan|food plan|khana|diet chart|diet kya ho/] },
    { intent: 'calories', words: [/how many calories|calorie|calory|kitni calorie|cal need|daily calories|calorie count|calorie deficit|calorie surplus/] },
    { intent: 'chest', words: [/chest exercise|chest workout|bench press|push.?up|seena|chest kaise banaye/] },
    { intent: 'back', words: [/back exercise|back workout|lat|pull.?up|deadlift|back kaise banaye/] },
    { intent: 'legs', words: [/leg exercise|leg workout|squat|leg day|tangein|legs kaise banaye|thigh/] },
    { intent: 'arms', words: [/arm exercise|bicep|tricep|arm workout|curl|baazu|arms kaise banaye/] },
    { intent: 'shoulders', words: [/shoulder exercise|shoulder workout|deltoid|shoulder press|kandhe/] },
    { intent: 'abs', words: [/abs exercise|abs workout|six.?pack|core|crunch|plank|pet ke exercise/] },
    { intent: 'six_pack', words: [/six pack|sixpack|6 pack|abs kaise banaye|abs banane/] },
    { intent: 'cardio', words: [/cardio|aerobic|heart rate|stamina|endurance/] },
    { intent: 'home_workout', words: [/home workout|ghar pe exercise|without gym|no gym|bina gym|home exercise/] },
    { intent: 'gym_workout', words: [/gym workout|gym plan|gym routine|gym schedule|gym me kya karu/] },
    { intent: 'yoga', words: [/yoga|asana|pranayam|surya namaskar|yogasan/] },
    { intent: 'stretching', words: [/stretch|flexibility|stiff|tight muscle/] },
    { intent: 'running', words: [/running|run|jogging|sprint|marathon|daudna/] },
    { intent: 'walking', words: [/walking|walk|10000 steps|chalna|daily walk/] },
    { intent: 'swimming', words: [/swimming|swim|pool|tairna/] },
    { intent: 'cycling', words: [/cycling|cycle|biking|bike ride|cycle chalana/] },
    { intent: 'height', words: [/height|grow tall|taller|lambai|height badhana|height increase|lambai kaise badhaye/] },
    { intent: 'sleep', words: [/sleep|neend|insomnia|nind|sone|sleeping|rest|sleep quality/] },
    { intent: 'water', words: [/water|pani|hydration|paani|kitna pani|dehydration/] },
    { intent: 'bmi', words: [/bmi|body mass|body mass index|mera bmi/] },
    { intent: 'supplements', words: [/supplement|vitamin|mineral|tablet|capsule|multivitamin/] },
    { intent: 'creatine', words: [/creatine|creatinine/] },
    { intent: 'whey', words: [/whey|protein powder|protein shake|shake/] },
    { intent: 'meal_timing', words: [/best time|kab khana|meal timing|when to eat|khane ka time/] },
    { intent: 'pre_workout', words: [/pre.?workout|before workout|exercise se pehle|workout se pehle/] },
    { intent: 'post_workout', words: [/post.?workout|after workout|exercise ke baad|workout ke baad/] },
    { intent: 'skin', words: [/skin|acne|pimple|glow|face|chehre|twacha|skin care/] },
    { intent: 'hair', words: [/hair|baal|hair fall|hair loss|baal girna|hair growth/] },
    { intent: 'digestion', words: [/digestion|digestive|constipation|bloat|gas|acidity|pet kharab|kabz|pet dard/] },
    { intent: 'immunity', words: [/immunity|immune|immune system|rog pratirodhak/] },
    { intent: 'stress', words: [/stress|anxiety|tension|worried|pareshan|chinta/] },
    { intent: 'meditation', words: [/meditation|meditate|mindful|dhyan|pranayam/] },
    { intent: 'diabetes', words: [/diabetes|sugar|blood sugar|madhumeh|sugar level/] },
    { intent: 'thyroid', words: [/thyroid|hypothyroid|hyperthyroid/] },
    { intent: 'pcos', words: [/pcos|pcod|polycystic/] },
    { intent: 'heart', words: [/heart|cardiovascular|blood pressure|bp|cholesterol|dil/] },
    { intent: 'back_pain', words: [/back pain|kamar dard|lower back|spine|kamar me dard/] },
    { intent: 'knee_pain', words: [/knee pain|knee problem|ghutne|ghutna dard|joint pain/] },
    { intent: 'pregnancy', words: [/pregnant|pregnancy|garbh|expecting|prenatal/] },
    { intent: 'egg', words: [/^egg$|anda|eggs? benefit|eggs? nutrition|kitne ande/] },
    { intent: 'milk', words: [/^milk$|dudh|milk benefit|doodh/] },
    { intent: 'ayurveda', words: [/ayurveda|ayurvedic|vata|pitta|kapha|desi nuskha/] },
    { intent: 'home_remedies', words: [/home remed|gharelu|nuskha|gharelu upay|dadi ma/] },
    { intent: 'detox', words: [/detox|cleanse|body detox|toxin|safai/] },
    { intent: 'energy', words: [/energy|tired|fatigue|thakan|lazy|low energy|stamina badhaye/] },
    { intent: 'motivation', words: [/motivation|motivate|inspire|give up|himmat|hosla|mann nahi|bore/] },
    { intent: 'plateau', words: [/plateau|stuck|weight not reducing|weight ruka|progress ruk/] },
    { intent: 'cheat_meal', words: [/cheat meal|cheat day|junk food|pizza|burger|samosa|chole bhature/] },
    { intent: 'alcohol', words: [/alcohol|beer|wine|drink|sharab|daru/] },
    { intent: 'sugar', words: [/sugar craving|sweet|meetha|sugar alternative|sugar kam/] },
    { intent: 'rice', words: [/rice|chawal|roti vs rice|rice fat|chawal khana/] },
    { intent: 'ghee', words: [/ghee|desi ghee|clarified butter/] },
    { intent: 'paneer', words: [/paneer|cottage cheese/] },
    { intent: 'chicken', words: [/chicken|murga|murgi|chicken breast/] },
    { intent: 'oats', words: [/oats|oatmeal|daliya|porridge/] },
    { intent: 'smoothie', words: [/smoothie|shake recipe|healthy drink|lassi/] },
    { intent: 'warm_up', words: [/warm.?up|before exercise|shuru karne se pehle/] },
    { intent: 'cool_down', words: [/cool.?down|after exercise|exercise ke baad kya/] },
    { intent: 'injury', words: [/injury|chot|prevent injury|safe exercise/] },
    { intent: 'body_type', words: [/body type|ectomorph|mesomorph|endomorph|mera body type/] },
    { intent: 'metabolism', words: [/metabolism|metabolic rate|metabolism slow|metabolism fast|metabolism badhaye/] },
  ];

  for (const p of patterns) {
    for (const regex of p.words) {
      if (regex.test(m)) return p.intent;
    }
  }
  return 'unknown';
}

// ==================== FOLLOW-UP DETECTION ====================

function isFollowUp(m, lastBot) {
  if (!lastBot) return false;
  const followUpPatterns = /^(yes|yeah|haan|ha|ok|sure|tell me more|aur batao|more|details|explain|aur|and|elaborate|continue|go on|example)/;
  return followUpPatterns.test(m);
}

function handleFollowUp(m, lastBot, u) {
  const lastMsg = lastBot.message.toLowerCase();
  if (lastMsg.includes('weight loss') || lastMsg.includes('calorie deficit')) {
    return `More weight loss tips, ${u.name}:\n\n🔬 **Research-Backed Methods**:\n\n1. **NEAT (Non-Exercise Activity Thermogenesis)**\n   Walk while on phone calls, take stairs, stand at desk.\n   Burns extra 200-500 cal/day!\n\n2. **Protein Loading**\n   Eat ${u.protein}g protein daily — keeps you full for hours.\n   Indian sources: Paneer (18g/100g), Moong dal (24g/100g), Chana (19g/100g)\n\n3. **Cold Water Theory**\n   Drink cold water before meals — body burns calories heating it up + fills stomach.\n\n4. **Fiber Strategy**\n   Eat salad FIRST before main meal. Fiber slows sugar absorption.\n   Indian fiber: Rajma, Oats, Guava, Psyllium husk (Isabgol)\n\n5. **Sleep & Cortisol**\n   Poor sleep = high cortisol = belly fat storage.\n   Sleep 7-8 hours. No screen 1hr before bed.\n\n📊 **Your Numbers**: Eat ${u.calories - 500} cal/day for 0.5 kg/week loss.\n\nWant a specific Indian meal plan for weight loss?`;
  }
  if (lastMsg.includes('weight gain') || lastMsg.includes('muscle') || lastMsg.includes('bulk')) {
    return `More mass gaining tips, ${u.name}:\n\n💪 **Advanced Strategies**:\n\n1. **Caloric Density Hacks**\n   Add ghee to dal/rice (+120 cal per tbsp)\n   Peanut butter on everything (+190 cal per 2 tbsp)\n   Banana shake with oats (+400 cal)\n\n2. **Meal Frequency**\n   Eat 6 meals/day, every 2.5-3 hours.\n   Never skip breakfast — it sets muscle protein synthesis.\n\n3. **Compound Lifts Priority**\n   Squat, Deadlift, Bench Press, Overhead Press, Rows\n   These release maximum growth hormone.\n\n4. **Progressive Overload**\n   Add 2.5kg to lifts every week. Track in a diary.\n   Aim for 8-12 reps for hypertrophy.\n\n5. **Sleep = Growth**\n   HGH (Human Growth Hormone) peaks during deep sleep.\n   Sleep 8 hours minimum. Nap 20 min post-workout if possible.\n\n🥤 **Mass Gainer Shake**: Banana + Oats + Milk + Peanut Butter + Honey + Whey = 600 cal\n\nWant a full 7-day mass gain meal plan?`;
  }
  return `Sure, ${u.name}! Here's more detail:\n\n${getRandomHealthFact()}\n\nAsk me anything specific — I'm here to help! 💪`;
}

// ==================== INTENT HANDLERS ====================

function handleGreeting(name, goal) {
  const greetings = [
    `Hey ${name}! 💪 I'm your FitAI Health Coach — powered by AI and backed by real nutrition science!\n\nI can help you with:\n🥗 Personalized diet plans (Indian & International)\n🏋️ Custom workout routines (Home & Gym)\n📊 BMI, calorie & macro calculations\n💊 Supplement guidance\n🧘 Yoga, meditation & mental wellness\n🏥 Health conditions (Diabetes, Thyroid, PCOS)\n🏃 Cardio, running & sports nutrition\n\nWhat would you like to know today?`,
    `Namaste ${name}! 🙏 Welcome to FitAI!\n\nI'm your personal health assistant. I know about:\n• Indian & International nutrition 🥗\n• Workout science 🏋️\n• Ayurveda & modern medicine 🧪\n• Mental wellness 🧘\n\nYour goal is ${goal.replace(/_/g, ' ')} — I'll tailor all my advice for that!\n\nAsk me anything! 💪`,
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function handleWeightLoss(name, calories, protein, weight, bmi, dietPref) {
  const deficit = calories - 500;
  return `Here's your complete weight loss guide, ${name}! 🔥\n\n📊 **Your Stats**:\n• Current BMI: ${bmi}\n• Daily calories needed: ${calories} kcal\n• Target for weight loss: ${deficit} kcal/day\n• Protein target: ${protein}g/day\n\n🥗 **Indian Diet Strategy**:\n• Breakfast: Moong dal chilla / Oats upma / Poha (250 cal)\n• Mid-morning: Green tea + 10 almonds (80 cal)\n• Lunch: 1 roti + dal + sabzi + salad (400 cal)\n• Evening: Makhana / Sprouts chaat (150 cal)\n• Dinner: Khichdi / Soup + 1 roti (300 cal)\n• Total: ~${deficit} cal\n\n🏃 **Workout Plan**:\n• Monday: 30 min cardio (HIIT)\n• Tuesday: Upper body strength\n• Wednesday: Yoga + stretching\n• Thursday: Lower body strength\n• Friday: 30 min running/cycling\n• Saturday: Full body circuit\n• Sunday: Active recovery (walking)\n\n🔬 **Science Tips**:\n• Eat protein first in every meal — triggers satiety hormones\n• Walk 10,000 steps daily — burns 300-400 extra calories\n• Drink ${Math.round(weight * 0.033)}L water — boosts metabolism by 30%\n• Sleep 7-8 hours — poor sleep increases ghrelin (hunger hormone)\n• Avoid eating after 8 PM — aids fat oxidation during sleep\n\n⏰ **Intermittent Fasting**: Try 16:8 — eat between 12 PM - 8 PM\n\n🎯 **Expected Results**: 2-4 kg/month with consistency!\n\nWant me to go deeper into any of these? 💪`;
}

function handleWeightGain(name, calories, protein, weight, dietPref) {
  const surplus = calories + 500;
  const isVeg = dietPref === 'veg' || dietPref === 'vegan';
  return `Here's your weight gain blueprint, ${name}! 💪\n\n📊 **Your Targets**:\n• Daily calories: ${surplus} kcal (500 surplus)\n• Protein: ${protein + 20}g/day minimum\n• Meals: 6 per day, every 2.5-3 hours\n\n🥗 **${isVeg ? 'Vegetarian' : 'Non-Veg'} Meal Plan**:\n\n🌅 **Breakfast (8 AM)** — 500 cal:\n${isVeg ? '• Paneer Paratha (2) + Curd + Banana shake' : '• 4 Egg omelette + 2 Toast + Milk shake'}\n\n🍌 **Mid-Morning (10:30 AM)** — 300 cal:\n• Banana + Peanut butter toast + Mixed nuts (30g)\n\n🍛 **Lunch (1 PM)** — 600 cal:\n${isVeg ? '• 3 Roti + Paneer/Rajma + Rice + Dal + Curd' : '• Rice + Chicken curry + Dal + Salad + Curd'}\n\n☕ **Evening (4:30 PM)** — 300 cal:\n• Protein shake + Banana + Peanuts\n\n🏋️ **Pre-Workout (6 PM)** — 150 cal:\n• Black coffee + Banana + 5 dates\n\n🍽️ **Dinner (8:30 PM)** — 500 cal:\n${isVeg ? '• 2 Roti + Soya chunk curry + Dal + Ghee' : '• 2 Roti + Egg curry/Grilled chicken + Rice'}\n\n🥛 **Bedtime** — 200 cal:\n• Warm milk + Turmeric + 1 tbsp Ghee + Honey\n\n📈 **Total: ~${surplus} calories | ${protein + 20}g+ protein**\n\n🏋️ **Gym Plan** (5 days/week):\n• Mon: Chest + Triceps\n• Tue: Back + Biceps\n• Wed: Rest (stretching only)\n• Thu: Legs + Abs\n• Fri: Shoulders + Arms\n• Sat: Full body compound lifts\n\n🔬 **Pro Tips**:\n• Add ghee/butter to meals — easy 200+ extra calories\n• Drink calories — shakes are easier than solid food\n• Progressive overload — add 2.5kg every week\n• Sleep 8 hours — HGH releases during deep sleep\n\n🎯 **Goal**: Gain 2-3 kg lean mass per month!\n\nWant specific shake recipes or exercise details?`;
}

function handleMuscleBuilding(name, protein, calories, weight, dietPref) {
  return `Muscle Building Guide for ${name}! 🏋️\n\n📊 **Science of Muscle Growth**:\nMuscle grows through: Mechanical Tension + Metabolic Stress + Muscle Damage\nYou need: Progressive Overload + Adequate Protein + Recovery\n\n🥩 **Protein Strategy**:\n• Target: ${protein + 20}g/day (2g per kg body weight)\n• Split into 5-6 meals (30-40g per meal)\n• Post-workout window: 40g protein within 30 min\n\n💪 **Push-Pull-Legs Split** (6 days):\n\n**PUSH (Mon/Thu)**: Chest + Shoulders + Triceps\n• Bench Press 4x8\n• Incline Dumbbell Press 3x10\n• Shoulder Press 4x8\n• Lateral Raises 3x12\n• Tricep Pushdown 3x12\n• Overhead Extension 3x12\n\n**PULL (Tue/Fri)**: Back + Biceps\n• Deadlift 4x6\n• Lat Pulldown 3x10\n• Bent Over Rows 4x8\n• Face Pulls 3x15\n• Barbell Curls 3x10\n• Hammer Curls 3x12\n\n**LEGS (Wed/Sat)**: Legs + Core\n• Squats 4x8\n• Leg Press 3x12\n• Lunges 3x10\n• Leg Curl 3x12\n• Calf Raises 4x15\n• Planks 3x60sec\n\n🔬 **Research-Backed Tips**:\n• Rest 2-3 min between heavy sets (ATP recovery)\n• Train each muscle 2x/week for optimal growth\n• Eccentric phase (lowering) builds more muscle — go slow\n• Compound movements > Isolation for beginners\n• Deload every 4th week (reduce weight by 40%)\n\n🎯 **Realistic Timeline**:\n• Month 1-3: Strength gains (neurological)\n• Month 3-6: Visible muscle growth\n• Month 6-12: Significant transformation\n• Beginner can gain 5-10 kg muscle in first year!\n\nWant specific exercise form tips or a nutrition plan?`;
}

function handleProtein(name, protein, weight, dietPref) {
  const isVeg = dietPref === 'veg' || dietPref === 'vegan';
  return `Protein Guide for ${name}! 🥩\n\n📊 **Your Daily Need: ${protein}g** (${(protein / weight).toFixed(1)}g per kg body weight)\n\n${isVeg ? `🥗 **Top Vegetarian Protein Sources** (per 100g):\n\n| Food | Protein | Calories |\n|------|---------|----------|\n| Soybean | 36g | 446 |\n| Peanuts | 26g | 567 |\n| Moong Dal | 24g | 347 |\n| Chana (Chickpea) | 19g | 364 |\n| Paneer | 18g | 265 |\n| Tofu | 17g | 144 |\n| Rajma | 15g | 333 |\n| Greek Yogurt | 10g | 59 |\n| Milk (1 glass) | 8g | 150 |\n| Curd (1 bowl) | 11g | 98 |` : `🍗 **Best Protein Sources** (per 100g):\n\n| Food | Protein | Calories |\n|------|---------|----------|\n| Chicken Breast | 31g | 165 |\n| Fish (Rohu/Pomfret) | 22g | 120 |\n| Eggs (1 whole) | 6g | 78 |\n| Egg White (1) | 3.6g | 17 |\n| Paneer | 18g | 265 |\n| Moong Dal | 24g | 347 |\n| Whey Protein (1 scoop) | 24g | 120 |\n| Greek Yogurt | 10g | 59 |\n| Soybean | 36g | 446 |\n| Chicken Thigh | 26g | 209 |`}\n\n📋 **Sample ${protein}g Protein Day**:\n• Breakfast: ${isVeg ? 'Moong dal chilla (2) + Milk' : '3 Eggs + Milk'} = ${isVeg ? '20' : '26'}g\n• Mid-morning: Peanuts (30g) + Curd = 15g\n• Lunch: ${isVeg ? 'Paneer sabzi + Dal + Roti' : 'Chicken curry + Dal + Roti'} = ${isVeg ? '30' : '40'}g\n• Evening: Protein shake = 24g\n• Dinner: ${isVeg ? 'Soya chunks + Roti' : 'Fish curry + Roti'} = ${isVeg ? '25' : '30'}g\n• Total: ~${isVeg ? '114' : '135'}g\n\n⏰ **Timing Tips**:\n• Eat protein within 30 min of waking\n• 30-40g per meal (body can absorb max 40g at once)\n• Post-workout: fast-absorbing whey or eggs\n• Before bed: slow-digesting casein (milk/paneer)\n\nWant to know about specific protein supplements?`;
}

function handleDietPlan(name, goal, calories, dietPref, weight) {
  const isVeg = dietPref === 'veg' || dietPref === 'vegan';
  const adjCal = goal === 'weight_loss' ? calories - 400 : goal === 'weight_gain' ? calories + 400 : calories;
  return `Your Personalized ${goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Diet Plan, ${name}! 🥗\n\n📊 Target: ${adjCal} cal/day | Water: ${Math.round(weight * 0.033)}L/day\n\n🌅 **Early Morning (6:30 AM)**:\n• Warm water + Lemon + Honey\n• ${goal === 'weight_loss' ? 'Apple cider vinegar (1 tsp)' : '5 soaked almonds + 2 walnuts'}\n\n🥣 **Breakfast (8:00 AM)** — ${goal === 'weight_loss' ? '250' : '450'} cal:\n${isVeg ? '• Option 1: Oats with milk + banana + seeds\n• Option 2: Moong dal chilla (2) + Green chutney\n• Option 3: Poha with peanuts + Buttermilk' : '• Option 1: 3 Egg omelette + Brown bread toast\n• Option 2: Oats with milk + banana + almonds\n• Option 3: Besan chilla + Boiled eggs (2)'}\n\n🍌 **Mid-Morning (10:30 AM)** — 150 cal:\n• Option 1: Mixed fruits bowl\n• Option 2: Roasted chana + Green tea\n• Option 3: Banana + 10 almonds\n\n🍛 **Lunch (1:00 PM)** — ${goal === 'weight_loss' ? '400' : '550'} cal:\n${isVeg ? '• 2 Multigrain roti + Dal + Sabzi + Salad + Curd\n• OR: Brown rice + Rajma/Chole + Raita + Salad' : '• 2 Roti + Chicken/Fish curry + Dal + Salad\n• OR: Rice + Egg curry + Sabzi + Curd'}\n\n☕ **Evening (4:30 PM)** — 150 cal:\n• Option 1: Sprouts salad + Lemon\n• Option 2: Makhana (roasted) + Green tea\n• Option 3: Peanut butter on multigrain toast\n\n🍽️ **Dinner (7:30 PM)** — ${goal === 'weight_loss' ? '300' : '450'} cal:\n${isVeg ? '• 1 Roti + Palak paneer + Soup\n• OR: Khichdi + Curd + Salad\n• OR: Vegetable daliya' : '• Grilled chicken + Salad + 1 Roti\n• OR: Fish tikka + Soup + Roti\n• OR: Egg bhurji + Roti + Curd'}\n\n🥛 **Bedtime (9:30 PM)**:\n• Warm milk + Turmeric (Haldi doodh)\n${goal === 'weight_gain' ? '• + 1 tbsp Ghee + Honey' : ''}\n\n📊 **Total: ~${adjCal} cal/day**\n\n💡 **Rules to Follow**:\n1. No sugar, maida, processed food\n2. Eat slowly — 20 min per meal\n3. 30 min gap between food & water\n4. Last meal 2-3 hours before sleep\n5. Cheat meal allowed 1x/week\n\nWant an international diet plan or specific recipes?`;
}

function handleIndianDiet(name, goal, calories, dietPref) {
  const isVeg = dietPref === 'veg' || dietPref === 'vegan';
  return `Traditional Indian Diet Plan for ${name}! 🇮🇳\n\n📖 **Based on Ayurveda + Modern Nutrition Science**\n\nIndia has one of the richest food cultures. Our traditional diet is naturally balanced when eaten right.\n\n🌿 **Superfoods of India**:\n• **Turmeric (Haldi)** — Anti-inflammatory, boosts immunity (add to milk/curries)\n• **Ghee** — Rich in Omega-3, aids digestion (1-2 tbsp/day is healthy)\n• **Moringa (Drumstick leaves)** — 7x more Vitamin C than oranges\n• **Amla** — Richest source of Vitamin C globally\n• **Ragi (Finger Millet)** — More calcium than milk!\n• **Sattu** — Bihar's superfood: 20g protein per 100g\n• **Makhana (Fox Nuts)** — Low cal, high protein snack\n• **Bajra/Jowar** — Gluten-free, fiber-rich ancient grains\n\n🥗 **7-Day Indian Meal Rotation**:\n\n**Mon**: Poha + Dal Chawal + Khichdi\n**Tue**: Idli Sambar + Rajma Rice + Roti Sabzi\n**Wed**: Besan Chilla + Chole Rice + Palak Paneer\n**Thu**: Upma + Dal Roti Salad + ${isVeg ? 'Dalia' : 'Chicken Rice'}\n**Fri**: Paratha + Kadhi Rice + ${isVeg ? 'Paneer Tikka' : 'Fish Curry'}\n**Sat**: Dosa + Biryani (${isVeg ? 'Veg' : 'Chicken'}) + Soup\n**Sun**: Cheat/Special meal day!\n\n📊 **Regional Power Foods**:\n• **North India**: Sarson ka saag + Makki roti, Chole, Rajma\n• **South India**: Idli, Dosa, Sambar, Rasam, Coconut chutney\n• **West India**: Dhokla, Thepla, Poha, Vada Pav (moderation)\n• **East India**: Fish curry, Litti Chokha, Sattu drinks\n\n🔬 **Research**: Indian thali is one of the most balanced meals globally — it includes grains, legumes, vegetables, dairy, and spices in one plate!\n\nWant specific recipes or state-wise diet plans?`;
}

function handleInternationalDiet(name, goal, calories) {
  return `International Diet Plans for ${name}! 🌍\n\n📊 **Top Research-Backed Diets Worldwide**:\n\n🫒 **1. Mediterranean Diet** (World's #1 Ranked Diet)\nOrigin: Greece, Italy, Spain\n• Focus: Olive oil, fish, vegetables, whole grains, nuts\n• Benefits: Heart health, weight loss, longevity\n• Sample Day:\n  - Breakfast: Greek yogurt + berries + honey + walnuts\n  - Lunch: Grilled fish + quinoa + olive oil salad\n  - Dinner: Grilled chicken + roasted vegetables + hummus\n• Research: Reduces heart disease risk by 30%\n\n🥑 **2. DASH Diet** (Best for Blood Pressure)\nOrigin: USA (NIH Developed)\n• Focus: Low sodium, high potassium, fruits, vegetables\n• Great for: Hypertension, heart health\n• Key foods: Bananas, spinach, nuts, whole grains\n\n🥩 **3. Paleo Diet**\nOrigin: Based on ancestral eating\n• Focus: Meat, fish, vegetables, nuts, seeds\n• Avoids: Grains, dairy, processed food, sugar\n• Good for: Fat loss, autoimmune conditions\n\n🇯🇵 **4. Japanese Diet** (World's Longest Living People)\n• Focus: Fish, seaweed, tofu, green tea, fermented foods\n• Key principle: Hara hachi bu — eat until 80% full\n• Why it works: Low calorie density, high nutrients\n\n🇰🇷 **5. Korean Diet**\n• Focus: Kimchi (probiotic), vegetables, lean protein\n• Benefits: Gut health, weight management, clear skin\n\n🇧🇷 **6. Brazilian Diet**\n• Focus: Rice & beans (complete protein), fresh fruits\n• Simple rule: Real food, not products\n\n💡 **Indian Adaptation**: Combine Mediterranean principles with Indian food:\n• Replace olive oil with cold-pressed mustard/coconut oil\n• Fish curry instead of grilled fish\n• Dal = Indian version of legumes\n• Curd/Raita = Indian probiotics\n\nWant me to create a fusion diet plan combining the best of these?`;
}

function handleKetoDiet(name, calories, weight, dietPref) {
  return `Keto Diet Guide for ${name}! 🥑\n\n📊 **What is Keto?**\nUltra-low carb diet that forces body to burn fat for fuel (ketosis).\n\n**Macro Split**:\n• Fat: 70-75% (~${Math.round(calories * 0.7 / 9)}g)\n• Protein: 20-25% (~${Math.round(calories * 0.25 / 4)}g)\n• Carbs: 5% (~${Math.round(calories * 0.05 / 4)}g = only 20-50g!)\n\n🇮🇳 **Indian Keto Foods**:\n✅ **Eat**: Paneer, Ghee, Coconut oil, Eggs, Butter, Cheese, Nuts, Seeds, Avocado, Green vegetables, Coconut\n❌ **Avoid**: Rice, Roti, Sugar, Fruits (except berries), Dal, Potatoes, Milk\n\n📋 **Indian Keto Meal Plan**:\n\n🌅 Breakfast: Paneer bhurji cooked in ghee + Bulletproof coffee\n🍌 Snack: Almonds (15) + Cheese cubes\n🍛 Lunch: Palak paneer + Cauliflower rice + Salad with olive oil\n☕ Evening: Coconut fat bombs + Green tea\n🍽️ Dinner: ${dietPref === 'non_veg' ? 'Butter chicken (no sugar) + Broccoli' : 'Mushroom + Cheese omelette + Avocado salad'}\n\n⚠️ **Keto Warnings**:\n• First 1-2 weeks: \"Keto flu\" — fatigue, headache (normal)\n• Drink extra water + electrolytes (salt, potassium)\n• NOT recommended for: Diabetics on insulin, pregnant women, kidney issues\n• Consult doctor before starting\n\n🔬 **Research**: Keto can cause rapid weight loss (3-5 kg in first month) but most is water weight initially. Fat loss starts from week 3.\n\n**My Recommendation**: For most Indians, a moderate low-carb diet (100-150g carbs) works better long-term than strict keto.\n\nWant me to create a moderate low-carb Indian plan instead?`;
}

function handleIntermittentFasting(name, weight, goal) {
  return `Intermittent Fasting Guide for ${name}! ⏰\n\n📊 **What is IF?**\nTime-restricted eating. You cycle between eating and fasting windows.\n\n🔄 **Popular Methods**:\n\n**1. 16:8 (Most Popular)** ⭐ RECOMMENDED\n• Fast 16 hours, eat in 8-hour window\n• Example: Eat 12 PM - 8 PM, fast 8 PM - 12 PM\n• Skip breakfast, have lunch + dinner\n\n**2. 18:6 (Intermediate)**\n• Fast 18 hours, eat in 6-hour window\n• Example: Eat 1 PM - 7 PM\n\n**3. 5:2 Method**\n• Eat normal 5 days, eat only 500-600 cal on 2 days\n\n**4. OMAD (One Meal A Day)** — Advanced\n• Eat one big meal per day (not for beginners)\n\n📋 **16:8 Indian Plan**:\n\n⬛ 6:00 AM - Wake up: Black coffee / Green tea / Warm lemon water (0 cal)\n⬛ 8:00 AM - Still fasting: Water, black tea (no milk/sugar)\n🟩 12:00 PM - BREAK FAST: Heavy lunch (Dal + Roti + Sabzi + Curd)\n🟩 3:30 PM - Snack: Fruits + Nuts + Buttermilk\n🟩 7:30 PM - Dinner: Light meal (Khichdi / Soup + Roti)\n⬛ 8:00 PM - FAST STARTS: Only water/herbal tea\n\n✅ **Benefits (Research-Proven)**:\n• Fat burning increases 14% after 12 hours of fasting\n• Autophagy (cellular cleanup) starts at ~16 hours\n• Insulin sensitivity improves — great for fat loss\n• Growth hormone increases by 500% during fasting!\n• Brain clarity improves\n\n⚠️ **Who Should NOT Do IF**:\n• Pregnant/breastfeeding women\n• Under 18 years age\n• People with eating disorders\n• Diabetics on medication (consult doctor first)\n\n💡 **Pro Tip**: Start with 14:10, then gradually increase to 16:8 over 2 weeks.\n\nWant specific meal plans for your fasting window?`;
}

function handleCalories(name, calories, bmr, goal, weight) {
  return `Calorie Guide for ${name}! 🔥\n\n📊 **Your Numbers**:\n• BMR (Basal Metabolic Rate): ${bmr} cal/day\n  → Calories your body burns at complete rest\n• TDEE (Total Daily Expenditure): ${calories} cal/day\n  → Calories you burn including activity\n\n🎯 **Your Target** (${goal.replace(/_/g, ' ')}):\n${goal === 'weight_loss' ? `• Eat ${calories - 500} cal/day (500 deficit)\n• Expected loss: ~0.5 kg/week\n• Aggressive: ${calories - 750} cal/day = 0.75 kg/week\n• Never go below ${bmr} cal!` : goal === 'weight_gain' ? `• Eat ${calories + 500} cal/day (500 surplus)\n• Expected gain: ~0.5 kg/week\n• Aggressive: ${calories + 750} cal/day = 0.75 kg/week` : `• Eat ${calories} cal/day to maintain weight\n• Fluctuation of ±200 cal is normal`}\n\n📋 **How to Count Calories (Indian Foods)**:\n\n| Food | Serving | Calories |\n|------|---------|----------|\n| Roti (1) | Medium | 120 |\n| Rice (1 katori) | 150g | 180 |\n| Dal (1 bowl) | 200ml | 150 |\n| Paneer (100g) | Medium | 265 |\n| Chicken (100g) | Breast | 165 |\n| Egg (1 whole) | Large | 78 |\n| Banana (1) | Medium | 105 |\n| Milk (1 glass) | 250ml | 150 |\n| Ghee (1 tbsp) | 15g | 120 |\n| Peanuts (handful) | 30g | 170 |\n\n💡 **Simple Rule**:\n• 1 standard Indian thali ≈ 600-800 calories\n• 1 paratha with butter ≈ 250 calories\n• 1 samosa ≈ 250 calories\n• 1 plate biryani ≈ 500-700 calories\n\nWant me to plan exact meals to hit your calorie target?`;
}

function handleChestWorkout(name) {
  return `Complete Chest Workout for ${name}! 💪\n\n🏠 **HOME (No Equipment)**:\n\n1. **Push-ups** — 4x15\n   Target: Full chest\n   Form: Hands shoulder-width, lower until chest touches floor\n\n2. **Wide Push-ups** — 3x12\n   Target: Outer chest\n   Form: Hands wider than shoulders\n\n3. **Diamond Push-ups** — 3x10\n   Target: Inner chest + Triceps\n   Form: Hands together forming diamond\n\n4. **Decline Push-ups** — 3x12\n   Target: Upper chest\n   Form: Feet elevated on chair/bed\n\n5. **Push-up Hold** — 3x20sec\n   Target: Endurance\n   Form: Hold bottom position of push-up\n\n🏋️ **GYM**:\n\n1. **Flat Bench Press** — 4x8-10 ⭐\n   The king of chest exercises!\n   Grip: Slightly wider than shoulders\n   Common mistake: Bouncing bar off chest\n\n2. **Incline Dumbbell Press** — 3x10\n   Target: Upper chest (the \"shelf\")\n   Angle: 30-45 degrees\n\n3. **Cable Flyes** — 3x12\n   Target: Inner chest definition\n   Tip: Squeeze at the center\n\n4. **Dips** — 3x12\n   Target: Lower chest\n   Lean forward for chest focus\n\n5. **Pec Deck / Chest Fly Machine** — 3x12\n   Target: Full chest squeeze\n   Great finisher exercise!\n\n🔬 **Pro Tips**:\n• Mind-muscle connection — FEEL the chest working\n• Squeeze at the top of every rep\n• Control the negative (lowering) — 3 seconds down\n• Chest needs 48-72 hours recovery between sessions\n• Progressive overload: add 2.5 kg every 1-2 weeks\n\nWant back, arms, or any other muscle group?`;
}

function handleBackWorkout(name) {
  return `Complete Back Workout for ${name}! 🔙\n\n🏠 **HOME**:\n1. **Pull-ups/Chin-ups** — 4x max reps (door bar)\n2. **Superman Hold** — 3x30 sec (lie face down, lift arms & legs)\n3. **Inverted Rows** (under table) — 3x12\n4. **Resistance Band Rows** — 3x15\n5. **Reverse Snow Angels** — 3x12\n\n🏋️ **GYM**:\n1. **Deadlift** — 4x6 ⭐ (King of all exercises)\n2. **Lat Pulldown** — 4x10 (wide grip for width)\n3. **Bent Over Rows** — 4x8 (barbell or dumbbell)\n4. **Seated Cable Row** — 3x12 (close grip)\n5. **Face Pulls** — 3x15 (rear delt & posture)\n6. **Single Arm Dumbbell Row** — 3x10\n\n💡 **Tips**: Squeeze shoulder blades together on every rep. Pull with elbows, not hands. Back is a large muscle — needs heavy weights and volume.\n\nWant workout for another muscle group?`;
}

function handleLegsWorkout(name) {
  return `Complete Leg Workout for ${name}! 🦵\n\nNEVER SKIP LEG DAY! Legs have the largest muscles — training them releases the most growth hormone.\n\n🏠 **HOME**:\n1. **Bodyweight Squats** — 4x20\n2. **Lunges** — 3x12 each leg\n3. **Jump Squats** — 3x15\n4. **Wall Sit** — 3x45 sec\n5. **Single Leg Calf Raises** — 3x20\n6. **Glute Bridges** — 3x15\n\n🏋️ **GYM**:\n1. **Barbell Squats** — 4x8 ⭐ (compound king)\n2. **Leg Press** — 4x10\n3. **Romanian Deadlift** — 3x10 (hamstrings + glutes)\n4. **Leg Extension** — 3x12 (quads isolation)\n5. **Leg Curl** — 3x12 (hamstring isolation)\n6. **Calf Raises** — 4x15 (standing or seated)\n7. **Bulgarian Split Squats** — 3x10 each\n\n🔬 **Science**: Squats increase testosterone and HGH naturally. Training legs boosts upper body gains too!\n\n**Common mistakes**: Knees caving in, not going deep enough (aim for parallel), rounding lower back on squats.\n\nWant another muscle group?`;
}

function handleArmsWorkout(name) {
  return `Arm Workout for ${name}! 💪\n\n🏠 **HOME**:\n**Biceps**: Diamond push-ups, Chin-ups (underhand grip), Towel curls (use a towel + weight)\n**Triceps**: Dips (chair), Close-grip push-ups, Overhead tricep extension (water bottle)\n\n🏋️ **GYM**:\n\n**BICEPS**:\n1. Barbell Curls — 4x10\n2. Incline Dumbbell Curls — 3x10\n3. Hammer Curls — 3x12\n4. Concentration Curls — 3x12\n\n**TRICEPS** (2/3 of arm size!):\n1. Close-Grip Bench Press — 4x8\n2. Tricep Pushdown — 3x12\n3. Overhead Cable Extension — 3x12\n4. Skull Crushers — 3x10\n\n**FOREARMS**:\n1. Wrist Curls — 3x15\n2. Reverse Curls — 3x12\n3. Farmer's Walk — 3x30 sec\n\n💡 **Secret**: Triceps are 2/3 of arm size. For bigger arms, focus MORE on triceps than biceps! Also, compound movements (rows, bench press) already train arms heavily.\n\nWant shoulders or any other group?`;
}

function handleShouldersWorkout(name) {
  return `Shoulder Workout for ${name}! 🎯\n\nShoulders have 3 heads: Front (anterior), Side (lateral), Rear (posterior). Train all 3 for round, 3D shoulders.\n\n🏋️ **Complete Shoulder Routine**:\n\n1. **Overhead Press** — 4x8 (barbell or dumbbell) ⭐\n   Targets: All 3 heads. The main mass builder.\n\n2. **Lateral Raises** — 4x12\n   Targets: Side delts (creates width)\n   Tip: Slight lean forward, pinky finger up\n\n3. **Front Raises** — 3x12\n   Targets: Front delts\n   Can use plate/dumbbell/cable\n\n4. **Face Pulls** — 3x15\n   Targets: Rear delts + rotator cuff\n   Essential for shoulder health!\n\n5. **Reverse Flyes** — 3x12\n   Targets: Rear delts\n   Use light weight, squeeze at top\n\n6. **Shrugs** — 4x12\n   Targets: Traps\n   Hold at top for 2 seconds\n\n🏠 **Home alternative**: Pike push-ups, Handstand hold against wall, Resistance band laterals, Water bottle lateral raises\n\n💡 Shoulders recover fast — can train 2-3x/week with moderate volume.\n\nWhat else do you want to train?`;
}

function handleAbsWorkout(name) {
  return `Abs & Core Workout for ${name}! 🔥\n\n⚠️ **Truth**: Abs are made in the kitchen! You can do 1000 crunches but abs won't show if body fat is above 15% (men) or 22% (women). Diet is 80% of the work.\n\n🏠 **Home Abs Routine** (15 min, no equipment):\n\n1. **Plank** — 3x60 sec\n2. **Bicycle Crunches** — 3x20\n3. **Mountain Climbers** — 3x30 sec\n4. **Leg Raises** — 3x15\n5. **Russian Twists** — 3x20\n6. **Dead Bug** — 3x10 each side\n7. **Flutter Kicks** — 3x30 sec\n\n🏋️ **Gym Abs**:\n1. **Hanging Leg Raises** — 3x12 (best ab exercise!)\n2. **Cable Crunches** — 3x15\n3. **Ab Wheel Rollout** — 3x10\n4. **Wood Choppers** — 3x12 each side\n\n🔬 **6-Pack Formula**:\n• Body fat < 15% for men / < 22% for women = abs visible\n• Calorie deficit + cardio for fat loss\n• Train abs 3-4x/week\n• Compound lifts (squats, deadlifts) also work core heavily\n• Ab definition ≈ 70% diet + 20% cardio + 10% ab exercises\n\nWant a complete fat-loss + abs plan?`;
}

function handleCardio(name, weight, goal) {
  const calBurn = Math.round(weight * 0.1);
  return `Cardio Guide for ${name}! 🏃\n\n📊 **Cardio Types**:\n\n**1. LISS (Low Intensity Steady State)**\n• Walking, light jogging, cycling\n• Duration: 30-60 min\n• Heart rate: 60-70% max\n• Best for: Fat burning zone, beginners\n• Burns: ~${calBurn * 30} cal/30 min\n\n**2. HIIT (High Intensity Interval Training)** ⭐\n• Sprint 30 sec → Walk 30 sec → Repeat\n• Duration: 15-20 min\n• Heart rate: 80-95% max\n• Best for: Maximum fat burn, time efficient\n• Burns: ~${calBurn * 50} cal/20 min + EPOC (burns calories for 24h after!)\n\n**3. MISS (Moderate Intensity)**\n• Jogging, cycling at moderate pace\n• Duration: 20-40 min\n• Heart rate: 70-80% max\n\n🏠 **Home HIIT Workout** (20 min):\n• Jumping Jacks — 30 sec\n• Rest — 15 sec\n• Burpees — 30 sec\n• Rest — 15 sec\n• Mountain Climbers — 30 sec\n• Rest — 15 sec\n• High Knees — 30 sec\n• Rest — 60 sec\n• Repeat 4 rounds\n\n💡 **Optimal Cardio Schedule for ${goal.replace(/_/g, ' ')}**:\n${goal === 'weight_loss' ? '• 3x HIIT + 2x LISS per week\n• Do cardio after weights (burn more fat)\n• Morning fasted cardio = extra fat burning' : goal === 'weight_gain' ? '• 2x light cardio per week (20 min max)\n• Do AFTER weight training only\n• Too much cardio = muscle loss!' : '• 3x moderate cardio per week\n• Mix HIIT and steady state'}\n\nWant specific running or cycling plans?`;
}

function handleHomeWorkout(name, goal) {
  return `Complete Home Workout Plan for ${name}! 🏠\n\nNo gym? No problem! Build an amazing body at home.\n\n📋 **5-Day Home Workout Split**:\n\n**DAY 1 - CHEST + TRICEPS**:\n• Push-ups: 4x15\n• Wide Push-ups: 3x12\n• Diamond Push-ups: 3x10\n• Decline Push-ups: 3x12\n• Tricep Dips (chair): 3x12\n• Plank: 3x45 sec\n\n**DAY 2 - BACK + BICEPS**:\n• Pull-ups (door bar): 4x max\n• Superman Hold: 3x30 sec\n• Inverted Rows (under table): 3x12\n• Towel Curls: 3x12\n• Reverse Push-ups: 3x10\n\n**DAY 3 - LEGS + GLUTES**:\n• Squats: 4x20\n• Lunges: 3x12 each\n• Jump Squats: 3x15\n• Single Leg Deadlift: 3x10 each\n• Calf Raises: 4x20\n• Glute Bridge: 3x15\n\n**DAY 4 - SHOULDERS + ABS**:\n• Pike Push-ups: 4x10\n• Lateral Raises (water bottles): 3x15\n• Plank: 3x60 sec\n• Bicycle Crunches: 3x20\n• Mountain Climbers: 3x30 sec\n• Leg Raises: 3x15\n\n**DAY 5 - HIIT CARDIO**:\n• Burpees: 4x10\n• Jumping Jacks: 4x30 sec\n• High Knees: 4x30 sec\n• Squat Jumps: 4x12\n• Plank Jacks: 4x20\n\n**DAY 6-7**: Rest or light walking/yoga\n\n🔧 **Cheap Equipment to Buy**:\n• Door pull-up bar (₹500-1000)\n• Resistance bands set (₹300-600)\n• Yoga mat (₹300-500)\n\nWant exercise form details or a gym version?`;
}

function handleGymWorkout(name, goal) {
  return `Gym Workout Plan for ${name}! 🏋️\n\n📋 **6-Day Push-Pull-Legs (PPL) Split**:\n\n**DAY 1 - PUSH (Chest + Shoulders + Triceps)**:\n1. Bench Press — 4x8\n2. Incline Dumbbell Press — 3x10\n3. Shoulder Press — 4x8\n4. Lateral Raises — 3x12\n5. Tricep Pushdown — 3x12\n6. Overhead Extension — 3x12\n\n**DAY 2 - PULL (Back + Biceps)**:\n1. Deadlift — 4x6\n2. Lat Pulldown — 4x10\n3. Bent Over Rows — 4x8\n4. Face Pulls — 3x15\n5. Barbell Curls — 3x10\n6. Hammer Curls — 3x12\n\n**DAY 3 - LEGS**:\n1. Squats — 4x8\n2. Leg Press — 3x12\n3. Romanian Deadlift — 3x10\n4. Leg Extension — 3x12\n5. Leg Curl — 3x12\n6. Calf Raises — 4x15\n\n**DAY 4**: PUSH (repeat with different exercises)\n**DAY 5**: PULL (repeat with different exercises)\n**DAY 6**: LEGS (repeat with different exercises)\n**DAY 7**: Complete REST\n\n⏱️ **Workout Rules**:\n• Warm up 5-10 min\n• Rest 2-3 min for heavy compound lifts\n• Rest 60-90 sec for isolation exercises\n• Total workout: 45-60 min max\n• Progressive overload every week\n• Log your weights in a diary\n\nWant specific exercise substitutions or home version?`;
}

function handleYoga(name) {
  return `Yoga Guide for ${name}! 🧘\n\n🌅 **Morning Yoga Routine** (20 min):\n\n1. **Surya Namaskar (Sun Salutation)** — 5 rounds\n   Burns ~100 cal, stretches full body\n   12 poses done in flow\n\n2. **Tadasana (Mountain Pose)** — 30 sec\n   Improves posture, height\n\n3. **Vrikshasana (Tree Pose)** — 30 sec each\n   Balance, focus, leg strength\n\n4. **Bhujangasana (Cobra Pose)** — 30 sec\n   Back flexibility, spine health\n\n5. **Padahastasana (Standing Forward Bend)** — 30 sec\n   Hamstring flexibility, calms mind\n\n6. **Shavasana (Corpse Pose)** — 5 min\n   Deep relaxation, stress relief\n\n🔬 **Proven Benefits**:\n• Reduces cortisol (stress hormone) by 25%\n• Improves flexibility by 35% in 8 weeks\n• Lowers blood pressure naturally\n• Improves sleep quality\n• Boosts mental clarity and focus\n• Helps with back pain, joint stiffness\n\n📖 **Pranayama (Breathing)**:\n• **Anulom Vilom** — Alternate nostril breathing (calming)\n• **Kapalbhati** — Belly pumping breath (energy + digestion)\n• **Bhramari** — Humming breath (anxiety relief)\n\n💡 Best time: Early morning, empty stomach\n\nWant specific yoga for weight loss, flexibility, or stress?`;
}

function handleStretching(name) {
  return `Stretching Guide for ${name}! 🤸\n\n**Before Workout** (Dynamic Stretching — 5 min):\n• Arm circles (30 sec)\n• Leg swings (30 sec each)\n• Hip circles (30 sec)\n• High knees (30 sec)\n• Torso twists (30 sec)\n\n**After Workout** (Static Stretching — 10 min):\n• Chest stretch (doorway) — 30 sec\n• Shoulder stretch — 30 sec each\n• Quad stretch (standing) — 30 sec each\n• Hamstring stretch (touch toes) — 30 sec\n• Hip flexor stretch (lunge) — 30 sec each\n• Cat-Cow stretch — 30 sec\n• Child's pose — 60 sec\n\n💡 Hold each stretch for 30 seconds minimum. Never bounce. Breathe deeply.\n\nWant a full flexibility routine?`;
}

function handleHeight(name, age) {
  return `Height Growth Guide for ${name}! 📏\n\n⚠️ **Science Facts**:\n• Height is 60-80% genetic\n• Growth plates close around age 18-21 (varies by person)\n• ${age > 20 ? 'At your age, growth plates may be closed. Focus on posture improvement (can add 1-2 inches visually).' : 'You still have growth potential! Follow these tips carefully.'}\n\n🧘 **Exercises for Height**:\n1. **Hanging** — 2-3 min daily (decompresses spine)\n2. **Cobra Stretch** — Stretches spine\n3. **Swimming** — Full body elongation\n4. **Skipping/Jumping** — Stimulates growth plates\n5. **Toe Touches** — Spine flexibility\n6. **Surya Namaskar** — Full body stretch\n7. **Pelvic Shift** — Spine alignment\n\n🥗 **Nutrition for Growth**:\n• **Calcium**: Milk, Curd, Paneer, Ragi (for bone growth)\n• **Vitamin D**: 15 min sunlight daily (calcium absorption)\n• **Protein**: Growth hormone needs protein\n• **Zinc**: Nuts, seeds (growth stimulant)\n• **Vitamin A**: Carrots, spinach (bone development)\n\n😴 **Sleep**: 8-9 hours! HGH (Human Growth Hormone) releases during deep sleep (10 PM - 2 AM peak).\n\n🧍 **Posture Hacks**:\n• Wall alignment exercise (stand against wall 5 min)\n• Chin tucks for forward head posture\n• Shoulder blade squeezes\n• Core strengthening (planks)\n• Avoid heavy backpacks\n\n🔬 **Research**: Good posture can make you appear 1-3 inches taller. Spine decompression exercises add temporary height that becomes semi-permanent with consistency.\n\nConsistency is key — results in 3-6 months!`;
}

function handleSleep(name) {
  return `Sleep Optimization Guide for ${name}! 😴\n\n📊 **Sleep Science**:\n• Ideal: 7-9 hours for adults\n• Deep sleep (Stage 3-4): Body repair + HGH release\n• REM sleep: Brain recovery + memory consolidation\n\n📋 **10 Rules for Perfect Sleep**:\n\n1. **Fixed Schedule** — Same bedtime daily (even weekends)\n2. **No Screens** — Blue light blocks melatonin. No phone 1hr before bed\n3. **Temperature** — Room at 18-22°C (slightly cool)\n4. **Darkness** — Use curtains/eye mask. Even small light disrupts melatonin\n5. **No Caffeine** — After 2 PM (caffeine has 6-hour half-life)\n6. **Light Dinner** — Eat 2-3 hours before bed. Heavy food = poor sleep\n7. **Exercise** — Morning/afternoon exercise improves sleep quality 65%\n8. **Relaxation** — 10 min meditation/deep breathing before bed\n9. **No Alcohol** — Alcohol disrupts REM sleep\n10. **Sunlight** — 15 min morning sunlight resets circadian rhythm\n\n🍵 **Natural Sleep Aids**:\n• Warm milk + Turmeric (Haldi doodh) — contains tryptophan\n• Chamomile tea — natural sedative\n• Ashwagandha — reduces cortisol by 30%\n• Magnesium-rich foods — Bananas, Almonds, Spinach\n• Lavender — put a few drops on pillow\n\n💪 **Why Sleep Matters for Fitness**:\n• HGH (growth hormone) released during deep sleep\n• Muscle repair happens during sleep\n• Poor sleep = 55% more belly fat storage\n• Sleep deprivation increases hunger hormone (ghrelin) by 28%\n• Recovery is when muscles GROW, not in the gym!\n\nWant tips for specific sleep problems?`;
}

function handleWater(name, weight, waterNeed) {
  return `Hydration Guide for ${name}! 💧\n\n📊 **Your Daily Need: ${waterNeed} liters** (based on ${weight}kg body weight)\n\nFormula: Body weight (kg) × 0.033 = liters of water\n\n⏰ **Water Schedule**:\n• 🌅 Wake up: 2 glasses (500ml) warm water + lemon\n• 🥣 30 min before breakfast: 1 glass\n• 🌤️ Mid-morning: 2 glasses\n• 🍛 30 min before lunch: 1 glass\n• ☕ Afternoon: 2 glasses\n• 🏋️ During workout: Sip every 15 min (~500ml total)\n• 🍽️ 30 min before dinner: 1 glass\n• 🌙 Before bed: 1 glass (not too much — disrupts sleep)\n\n✅ **Benefits**:\n• Boosts metabolism by 30%\n• Aids weight loss — hunger is often dehydration\n• Clearer skin within 2 weeks\n• Better digestion\n• More energy & focus\n• Flushes toxins\n• Reduces joint pain\n\n⚠️ **Signs of Dehydration**: Dark yellow urine, headache, fatigue, dry lips, dizziness\n\n✅ **Urine Color Test**: Pale yellow = well hydrated. Dark yellow = drink more water!\n\n💡 **Hack**: Keep a 1L bottle always visible. Fill it ${Math.ceil(waterNeed)} times a day.\n\n🚫 **Don't**: Drink water during meals (dilutes digestive enzymes). Wait 30 min before and after meals.`;
}

function handleBMI(name, bmi, weight, height) {
  const category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const idealMin = (18.5 * (height / 100) ** 2).toFixed(1);
  const idealMax = (24.9 * (height / 100) ** 2).toFixed(1);
  return `Your BMI Analysis, ${name}! 📊\n\n📏 **Your BMI: ${bmi} (${category})**\n\n• Height: ${height} cm\n• Weight: ${weight} kg\n• Healthy weight range: ${idealMin} - ${idealMax} kg\n\n📋 **BMI Scale**:\n• Under 18.5 = Underweight\n• 18.5 - 24.9 = Normal ✅\n• 25 - 29.9 = Overweight\n• 30+ = Obese\n\n${category === 'Normal' ? '✅ Great! You\'re in a healthy range. Focus on maintaining through balanced diet and regular exercise.' : category === 'Underweight' ? '⬆️ You need to gain weight healthily. Focus on calorie surplus (+500 cal/day) and strength training.' : '⬇️ Focus on gradual weight loss. Calorie deficit (-500 cal/day) + regular cardio + clean eating.'}\n\n⚠️ **BMI Limitation**: BMI doesn't distinguish between muscle and fat. A muscular person may show \"overweight\" BMI but be perfectly healthy. Body fat percentage is a better indicator.\n\nUse our BMI Calculator for detailed analysis!`;
}

function handleSupplements(name, goal, dietPref) {
  return `Supplement Guide for ${name}! 💊\n\n⚠️ **Important**: Supplements are NOT a replacement for real food. They only SUPPLEMENT a good diet.\n\n📋 **Essential Supplements** (for everyone):\n\n1. **Vitamin D3** — 2000-4000 IU/day\n   Why: 70%+ Indians are deficient. Crucial for bones, immunity, mood\n   Best time: Morning with fat-containing meal\n\n2. **Omega-3 (Fish Oil)** — 1000-2000mg/day\n   Why: Anti-inflammatory, heart health, joint health, brain function\n   ${dietPref === 'veg' ? 'Veg option: Flaxseed oil capsules' : 'Source: Fish oil capsules'}\n\n3. **Multivitamin** — 1/day\n   Why: Covers micronutrient gaps\n   Best time: With breakfast\n\n📋 **Goal-Specific Supplements**:\n\n${goal === 'weight_loss' || goal === 'fat_loss' ? '**For Fat Loss**:\n• Green Tea Extract — boosts metabolism\n• L-Carnitine — helps transport fat for energy\n• Apple Cider Vinegar capsules — aids digestion\n• Fiber supplement (Isabgol) — keeps you full' : '**For Muscle Building**:\n• Whey Protein — 1-2 scoops/day (post-workout)\n• Creatine Monohydrate — 5g/day (proven muscle builder)\n• BCAAs — during workout (anti-catabolic)\n• ZMA — zinc + magnesium (sleep + recovery)'}\n\n🇮🇳 **Indian Herbal Supplements**:\n• **Ashwagandha** — Reduces stress, improves testosterone, strength\n• **Shilajit** — Energy, stamina, anti-aging\n• **Triphala** — Digestion, detox\n• **Brahmi** — Brain function, memory\n• **Amla** — Vitamin C, immunity\n\n⚠️ **Avoid**: Fat burners, testosterone boosters, anything with \"proprietary blend\". Mostly scams!\n\nWant details on any specific supplement?`;
}

function handleCreatine(name, weight) {
  return `Creatine Guide for ${name}! ⚡\n\n📊 **What is Creatine?**\nThe most researched and proven supplement in fitness history. It increases ATP (energy) in muscles, allowing you to lift heavier and recover faster.\n\n✅ **Benefits** (all research-proven):\n• Increases strength by 5-10%\n• Increases lean muscle mass\n• Improves high-intensity performance\n• Faster muscle recovery\n• May improve brain function\n\n📋 **How to Take**:\n• **Dose**: 5g/day (Creatine Monohydrate)\n• **Timing**: Any time — consistency matters more than timing\n• **Loading phase**: Optional (20g/day for 5 days, then 5g/day)\n• **Mix with**: Water, juice, or protein shake\n• **Duration**: Safe for long-term use\n\n💧 **Important**: Drink extra 500ml water daily when taking creatine. It pulls water into muscles.\n\n⚠️ **Myths Busted**:\n❌ \"Creatine is a steroid\" — FALSE. It's naturally found in meat\n❌ \"Creatine damages kidneys\" — FALSE (in healthy individuals)\n❌ \"Creatine causes hair loss\" — No strong evidence\n❌ \"You need to cycle creatine\" — FALSE\n\n🛒 **Best brand**: Any brand with \"Creapure\" certification. Price: ₹800-1500 for 60 servings.\n\n🇮🇳 **Natural creatine sources**: Red meat (5g per kg), Fish (4g per kg) — but supplementation is more practical.`;
}

function handleWheyProtein(name, protein, dietPref) {
  return `Whey Protein Guide for ${name}! 🥤\n\n📊 **Your protein need: ${protein}g/day**\nIf you can't get enough from food alone, whey helps bridge the gap.\n\n📋 **Types of Whey**:\n1. **Whey Concentrate** — 70-80% protein, cheaper, has some lactose\n2. **Whey Isolate** — 90%+ protein, low lactose, faster absorption ⭐\n3. **Whey Hydrolysate** — Pre-digested, fastest absorption, most expensive\n${dietPref === 'veg' ? '\n4. **Plant Protein** — Pea + Rice blend. Good veg alternative!' : ''}\n\n⏰ **Best Times**:\n• Post-workout (within 30 min) — most important\n• Morning (with breakfast)\n• Between meals (if protein gap)\n\n🥤 **Shake Recipes**:\n\n**Mass Gainer Shake** (600 cal):\nMilk + Banana + Oats + Peanut butter + Whey + Honey\n\n**Fat Loss Shake** (200 cal):\nWater + Whey + Ice + Cinnamon\n\n**Balanced Shake** (350 cal):\nMilk + Whey + Banana + Almonds\n\n💰 **Budget**: Good whey costs ₹1500-3000 per kg. Avoid very cheap brands (may be adulterated). Look for brands tested by third parties.\n\n⚠️ **Side Effects**: Bloating/gas if lactose intolerant → use Isolate. Start with half scoop and increase gradually.\n\nWant recommendations for specific brands or alternatives?`;
}

function handleMealTiming(name, goal) {
  return `Optimal Meal Timing for ${name}! ⏰\n\n🌅 6:30 AM — Warm water + Lemon\n🥣 8:00 AM — Breakfast (high protein + complex carbs)\n🍌 10:30 AM — Mid-morning snack (fruits/nuts)\n🍛 1:00 PM — Lunch (largest meal of the day)\n☕ 4:00 PM — Evening snack (light protein)\n🏋️ 5:30 PM — Pre-workout (banana/dates + black coffee)\n💪 7:00 PM — Post-workout (protein shake/eggs)\n🍽️ 8:00 PM — Light dinner\n🥛 9:30 PM — Warm milk (optional)\n\n📌 **Rules**:\n• Eat within 1 hour of waking up\n• No heavy food after 8 PM\n• 30 min gap between water & food\n• Post-workout meal within 30 min\n• Eat every 2.5-3 hours (maintains metabolism)\n${goal === 'weight_loss' ? '• Try IF: Skip breakfast, eat 12 PM - 8 PM' : ''}\n\n🔬 **Research**: Meal timing matters less than total daily intake. But consistent timing helps regulate hunger hormones and digestion.\n\nWant a specific time-based meal plan?`;
}

function handlePreWorkout(name) {
  return `Pre-Workout Guide for ${name}! ⚡\n\n⏰ **Eat 30-60 min before workout**:\n\n🍌 **Quick Options**:\n• Banana + Black coffee\n• 5 Dates + Green tea\n• Peanut butter toast\n• Apple + Almonds (10)\n• Oats + Banana (if 60 min before)\n\n☕ **Caffeine**: 100-200mg (1-2 cups coffee) 30 min before workout. Proven to increase performance 5-10%.\n\n⚠️ **Avoid**: Heavy meals (takes too long to digest), high fiber, high fat before workout.\n\n💊 **Pre-Workout Supplements** (optional):\n• Caffeine — Energy\n• Citrulline — Better pumps\n• Beta-Alanine — Endurance (causes tingling - normal)\n\n🚫 **Don't train fully empty stomach** — you'll fatigue faster and lose muscle. Exception: Light fasted cardio for fat loss is OK.`;
}

function handlePostWorkout(name, protein, dietPref) {
  return `Post-Workout Nutrition for ${name}! 💪\n\n⏰ **Eat within 30-45 min after workout** (Anabolic window)\n\n📋 **What to eat**:\n• **Protein**: 30-40g (for muscle repair)\n• **Carbs**: 50-80g (replenish glycogen)\n• **Low fat**: Fat slows absorption\n\n🥗 **Best Post-Workout Meals**:\n${dietPref === 'non_veg' ? '1. Chicken breast + Rice + Banana\n2. 3 Eggs + 2 Toast + Milk\n3. Fish curry + Rice' : '1. Paneer bhurji + 2 Roti + Banana\n2. Whey protein shake + Banana\n3. Chana/Sprouts + Rice + Curd'}\n4. Whey protein + Banana (quickest option)\n5. Peanut butter sandwich + Milk\n\n🔬 **Science**: Post-workout, muscles are like a sponge — they absorb nutrients 50% more efficiently. This is when protein synthesis is highest.\n\n⚠️ **Avoid post-workout**: Junk food, sugary drinks, alcohol (kills recovery), high-fat meals (slows absorption).`;
}

function handleSkinHealth(name) {
  return `Skin Health Guide for ${name}! ✨\n\n🥗 **Diet for Glowing Skin**:\n• **Water**: ${name}, this is #1! 3-4L daily flushes toxins\n• **Vitamin C**: Amla, Orange, Lemon — boosts collagen\n• **Vitamin E**: Almonds, Sunflower seeds — anti-aging\n• **Omega-3**: Walnuts, Flaxseed — reduces inflammation\n• **Zinc**: Pumpkin seeds, Chickpeas — prevents acne\n• **Antioxidants**: Green tea, Berries, Turmeric\n\n🏠 **Indian Home Remedies**:\n• **Haldi + Dahi face pack** — Brightening\n• **Multani mitti pack** — Oil control\n• **Aloe vera gel** — Hydration + healing\n• **Neem face wash** — Anti-bacterial\n• **Rose water toner** — Pore tightening\n\n🏃 **Exercise for Skin**:\n• Cardio increases blood flow → natural glow\n• Sweating opens pores → detox\n• Always wash face after workout\n\n⚠️ **Avoid**: Sugar (causes inflammation), Processed food, Dairy (for some, causes acne), Touching face frequently\n\n😴 **Beauty sleep**: 7-8 hours. Skin repairs at night. Use silk pillowcase to prevent wrinkles.`;
}

function handleHairHealth(name, dietPref) {
  return `Hair Health Guide for ${name}! 💇\n\n📋 **Causes of Hair Fall**:\n• Protein deficiency (#1 cause)\n• Iron/Zinc deficiency\n• Vitamin D deficiency\n• Stress & poor sleep\n• Hormonal imbalance (thyroid, DHT)\n• Poor diet\n\n🥗 **Diet for Strong Hair**:\n• **Biotin**: Eggs, Almonds, Sweet potato\n• **Iron**: Spinach, Jaggery, Pomegranate\n• **Protein**: Hair IS protein (keratin). Eat ${dietPref === 'veg' ? 'dal, paneer, soya' : 'eggs, chicken, fish'}\n• **Zinc**: Pumpkin seeds, Nuts\n• **Omega-3**: Flaxseed, Walnuts\n• **Vitamin E**: Almonds, Sunflower seeds\n\n🏠 **Indian Hair Remedies**:\n• **Onion juice** — Apply on scalp, wash after 30 min (reduces hair fall by 80%!)\n• **Coconut oil + Curry leaves** — Warm, massage into scalp\n• **Amla oil** — Strengthens roots\n• **Fenugreek (Methi) paste** — Soak overnight, grind, apply as mask\n• **Aloe vera** — Apply fresh gel on scalp\n\n💊 **Supplements**: Biotin 5000mcg, Iron (if deficient), Vitamin D3, Zinc\n\n⚠️ Normal hair fall: 50-100 strands/day. More than that → check thyroid and iron levels.`;
}

function handleDigestion(name) {
  return `Digestion Guide for ${name}! 🫃\n\n📋 **For Better Digestion**:\n\n1. **Eat slowly** — Chew 20-30 times per bite\n2. **Don't drink water during meals** — Wait 30 min\n3. **Eat fiber**: 25-30g/day (vegetables, fruits, whole grains)\n4. **Probiotics**: Curd, Buttermilk, Idli, Dosa (fermented foods)\n5. **Walk 10 min after meals** — aids digestion\n\n🏠 **Indian Remedies**:\n• **Ajwain water** — Boil ajwain in water, sip warm (gas/bloating)\n• **Jeera water** — Roast jeera, boil in water (acidity)\n• **Hing (Asafoetida)** — Pinch in warm water (instant gas relief)\n• **Triphala** — Before bed with warm water (constipation)\n• **Isabgol (Psyllium husk)** — With warm milk at night\n• **Ginger tea** — After meals (improves digestion 30%)\n\n⚠️ **Avoid**: Eating too fast, lying down after meals, too much spicy/oily food, late night eating, excessive tea/coffee on empty stomach.\n\n🔬 **Gut Health**: 70% of immunity is in the gut. A healthy gut = strong immunity, better mood, clearer skin, and better nutrient absorption.`;
}

function handleImmunity(name, dietPref) {
  return `Immunity Boosting Guide for ${name}! 🛡️\n\n🥗 **Top Immunity Foods**:\n1. **Turmeric (Haldi)** — Curcumin is a powerful immune booster\n2. **Amla** — Richest natural Vitamin C source\n3. **Ginger (Adrak)** — Anti-viral, anti-inflammatory\n4. **Garlic (Lahsun)** — Natural antibiotic (eat raw for best effect)\n5. **Tulsi** — Holy basil — antiviral, antibacterial\n6. **Honey** — Antimicrobial, soothes throat\n7. **Black Pepper** — Enhances absorption of turmeric by 2000%\n8. **Curd/Yogurt** — Probiotics strengthen gut immunity\n\n🍵 **Daily Immunity Drink** (Kadha):\nBoil: Tulsi leaves + Ginger + Dalchini + Kali mirch + Honey\nDrink warm, once daily.\n\n💊 **Supplements**:\n• Vitamin C — 500-1000mg/day\n• Vitamin D3 — 2000 IU/day\n• Zinc — 15-30mg/day\n• Ashwagandha — Adaptogen, reduces stress (stress kills immunity)\n\n🏃 **Lifestyle**:\n• Exercise 30 min/day (moderate — not excessive)\n• Sleep 7-8 hours (immunity drops 70% with poor sleep)\n• Reduce stress (cortisol suppresses immune system)\n• Stay hydrated\n• Wash hands frequently\n\n🔬 **Research**: Regular moderate exercise boosts immune function by 40-50%. But overtraining suppresses it. Balance is key!`;
}

function handleStress(name) {
  return `Stress Management for ${name}! 🧘\n\n📊 **Why Stress is the #1 Health Enemy**:\n• Increases cortisol → belly fat storage\n• Suppresses immunity by 70%\n• Causes insomnia → poor recovery\n• Triggers emotional eating\n• Raises blood pressure & heart risk\n\n📋 **10 Proven Stress Busters**:\n\n1. **Deep Breathing** — 4-7-8 technique\n   Inhale 4 sec → Hold 7 sec → Exhale 8 sec\n   Activates parasympathetic nervous system\n\n2. **Exercise** — 30 min releases endorphins (natural mood booster)\n\n3. **Meditation** — 10 min/day reduces cortisol by 25%\n\n4. **Walk in Nature** — 20 min in green space reduces cortisol 20%\n\n5. **Limit Screen Time** — Social media increases anxiety\n\n6. **Journaling** — Write 3 things you're grateful for daily\n\n7. **Music** — Slow music reduces heart rate and cortisol\n\n8. **Laughter** — Watch comedy. Laughter reduces stress hormones 30%\n\n9. **Cold Shower** — 30 sec cold water. Reduces inflammation, boosts mood\n\n10. **Social Connection** — Talk to friends/family. Isolation worsens stress\n\n🍵 **Calming Foods**: Chamomile tea, Ashwagandha, Dark chocolate (in moderation), Almonds, Bananas, Green tea (L-theanine)\n\nWant to learn specific meditation techniques?`;
}

function handleMeditation(name) {
  return `Meditation Guide for ${name}! 🧘‍♂️\n\n📋 **Beginner Meditation** (10 min):\n\n1. Sit comfortably (floor/chair)\n2. Close eyes gently\n3. Focus on your breathing\n4. Inhale through nose — 4 seconds\n5. Exhale through mouth — 6 seconds\n6. When mind wanders (it will!) — gently bring focus back to breath\n7. No judgment. Wandering mind is normal\n8. Start with 5 min, increase to 20 min over weeks\n\n🧘 **Types of Meditation**:\n• **Mindfulness** — Focus on present moment, observe thoughts without judgment\n• **Body Scan** — Focus on each body part, release tension\n• **Loving Kindness** — Send positive wishes to yourself and others\n• **Mantra** — Repeat \"Om\" or \"So Hum\" with each breath\n• **Guided** — Follow an audio guide (great for beginners)\n\n🔬 **Proven Benefits**:\n• Reduces anxiety by 60%\n• Improves focus and memory\n• Lowers blood pressure\n• Reduces cortisol (stress hormone)\n• Improves sleep quality\n• Increases gray matter in brain\n• Just 8 weeks of meditation physically changes brain structure!\n\n⏰ **Best time**: Early morning (5-6 AM) or before bed\n\nStart today — even 5 minutes makes a difference! 🙏`;
}

function handleDiabetes(name, dietPref) {
  return `Diabetes Management Guide for ${name}! 🩺\n\n⚠️ **Disclaimer**: This is general health information. Always consult your doctor for medical advice.\n\n📊 **Diabetes-Friendly Indian Diet**:\n\n✅ **Eat**:\n• Bitter gourd (Karela) — natural insulin effect\n• Fenugreek (Methi) seeds — reduces blood sugar\n• Jamun — traditional anti-diabetic fruit\n• Whole grains: Brown rice, Jowar, Bajra roti\n• Green leafy vegetables: Palak, Methi\n• Cinnamon (Dalchini) — improves insulin sensitivity\n• High fiber dal — Moong, Masoor\n\n❌ **Avoid**:\n• White rice (switch to brown rice or cauliflower rice)\n• White bread, Maida products\n• Sugar, Jaggery, Honey in excess\n• Fruit juices (eat whole fruits instead — fiber slows sugar)\n• Potatoes, Sweet potatoes in excess\n• Packaged/Processed foods\n\n🏃 **Exercise**: Walk 30-45 min daily after meals. Walking after eating reduces blood sugar spike by 30%.\n\n🏠 **Home Remedies**:\n• Soak methi seeds overnight, drink water in morning\n• Karela juice on empty stomach\n• Dalchini (cinnamon) in warm water\n• Jamun seeds powder — 1 tsp with water\n\n📋 **Lifestyle**: Regular meals at fixed times, never skip meals, manage stress (cortisol raises blood sugar), sleep 7-8 hours.\n\nAlways monitor blood sugar regularly and follow doctor's medications.`;
}

function handleThyroid(name, gender) {
  return `Thyroid Health Guide for ${name}! 🦋\n\n⚠️ **Consult your doctor for proper diagnosis and treatment.**\n\n📊 **Thyroid Basics**:\n• Hypothyroid (low thyroid) — Weight gain, fatigue, hair loss, cold sensitivity\n• Hyperthyroid (high thyroid) — Weight loss, anxiety, rapid heartbeat\n• ${gender === 'female' ? 'Women are 5-8x more likely to have thyroid issues' : 'Less common in men but still important to check'}\n\n🥗 **Diet for Thyroid**:\n\n✅ **Eat**:\n• Selenium: Brazil nuts, Sunflower seeds, Eggs (supports thyroid function)\n• Iodine: Iodized salt, Seaweed, Dairy (essential for thyroid hormones)\n• Zinc: Pumpkin seeds, Chickpeas\n• Vitamin D: Sunlight, Fortified milk\n• Coconut oil: Supports metabolism\n• Ashwagandha: Shown to normalize thyroid levels\n\n❌ **Avoid/Limit**:\n• Raw cruciferous vegetables (Broccoli, Cauliflower, Cabbage) — contain goitrogens. Cook them before eating.\n• Soy products in excess\n• Gluten (some studies link to autoimmune thyroid)\n• Processed foods, Sugar\n\n🏃 **Exercise**: Very important! Start with walking/yoga. Progress to moderate strength training. Exercise boosts metabolism that thyroid slows down.\n\n💊 **Supplements**: Selenium, Zinc, Vitamin D, Ashwagandha (consult doctor first).\n\nRegular thyroid panel (TSH, T3, T4) every 3-6 months.`;
}

function handlePCOS(name) {
  return `PCOS Management Guide for ${name}! 🎀\n\n⚠️ **Consult gynecologist for proper treatment.**\n\n📊 **What is PCOS?**\nPolycystic Ovary Syndrome — hormonal imbalance affecting 1 in 5 Indian women.\nSymptoms: Irregular periods, weight gain, acne, hair growth, hair thinning.\n\n🥗 **PCOS Diet**:\n\n✅ **Eat**:\n• Anti-inflammatory foods: Turmeric, Ginger, Green leafy veg\n• Complex carbs: Brown rice, Oats, Sweet potato\n• Healthy fats: Nuts, Seeds, Coconut oil, Ghee\n• Protein: Paneer, Dal, Eggs, Fish\n• Cinnamon: Improves insulin resistance\n• Spearmint tea: Reduces androgen levels\n\n❌ **Avoid**:\n• Refined carbs: Maida, White bread, Biscuits\n• Sugar and sugary drinks\n• Processed/Packaged food\n• Dairy in excess (can increase androgens in some women)\n• Caffeine in excess\n\n🏃 **Exercise** (CRUCIAL for PCOS):\n• 30-45 min daily, 5 days/week\n• Best: Brisk walking, Yoga, Swimming, Light weight training\n• Strength training is especially beneficial — improves insulin sensitivity\n• Yoga: Surya Namaskar, Butterfly pose, Bridge pose\n\n💊 **Helpful Supplements** (ask your doctor):\n• Inositol (Myo-inositol + D-chiro inositol)\n• Vitamin D\n• Omega-3\n• Chromium\n• Spearmint tea\n\n🔬 **Key insight**: PCOS is closely linked to insulin resistance. Managing blood sugar through diet and exercise is the #1 treatment alongside medication.`;
}

function handleHeartHealth(name, bmi) {
  return `Heart Health Guide for ${name}! ❤️\n\n${bmi > 25 ? '⚠️ Your BMI is above 25 — this increases heart disease risk. Focus on gradual weight loss.' : '✅ Your BMI is in a healthy range for heart health.'}\n\n🥗 **Heart-Healthy Indian Diet**:\n• Reduce salt to < 5g/day (Indian food is typically high in salt)\n• Use mustard oil/olive oil instead of refined oil\n• Eat more fiber: Oats, Flaxseed, Fruits, Vegetables\n• Garlic: Natural blood thinner, lowers cholesterol\n• Omega-3: Walnuts, Flaxseed, Fish\n• Avoid trans fats: No vanaspati, margarine, fried snacks\n\n🏃 **Exercise**: 30 min moderate cardio, 5 days/week. Walking, cycling, swimming.\n\n📋 **Lifestyle**:\n• No smoking\n• Limit alcohol\n• Manage stress (high cortisol damages arteries)\n• Sleep 7-8 hours\n• Regular BP & cholesterol checks after age 30\n\n🔬 **Research**: Heart disease is India's #1 killer. Indians are genetically more prone to heart disease. Prevention through diet and exercise is 80% effective!\n\nConsult a cardiologist if you have family history of heart disease.`;
}

function handleBackPain(name) {
  return `Back Pain Relief for ${name}! 🔙\n\n⚠️ **If pain is severe or radiating to legs, consult a doctor immediately.**\n\n🧘 **Exercises for Back Pain Relief**:\n1. **Cat-Cow Stretch** — 10 reps. On all fours, arch and round back.\n2. **Child's Pose** — 30 sec. Sit back on heels, stretch arms forward.\n3. **Knee-to-Chest** — 30 sec each. Lie on back, pull one knee to chest.\n4. **Bird-Dog** — 10 each side. Opposite arm and leg extension.\n5. **Pelvic Tilts** — 15 reps. Lie on back, flatten lower back against floor.\n6. **Cobra Stretch** — 30 sec. Lie face down, push upper body up.\n\n💡 **Prevention**:\n• Strengthen core muscles (planks!)\n• Maintain proper posture while sitting\n• Take breaks every 30 min if desk job\n• Sleep on firm mattress\n• Lift with legs, not back\n• Avoid sitting cross-legged for long\n\n🏠 **Indian Remedies**: Warm mustard oil massage, Ajwain poultice, Turmeric milk, Hot water bag on affected area.\n\n📋 **Posture fix**: Shoulders back, chin tucked, core engaged, feet flat on floor while sitting.`;
}

function handleKneePain(name) {
  return `Knee Pain Guide for ${name}! 🦵\n\n⚠️ **Consult orthopedic doctor if pain is persistent or severe.**\n\n🧘 **Safe Exercises**:\n1. **Straight Leg Raises** — Strengthen quads without knee stress\n2. **Wall Sits** — 30 sec. Build quad strength\n3. **Step-ups** — Low step, controlled movement\n4. **Swimming** — Zero impact on knees\n5. **Cycling** — Low impact, builds knee stability\n\n❌ **Avoid**: Deep squats, Jumping, Running on hard surface, Lunges (if painful)\n\n💡 **Tips**:\n• Lose weight if overweight (every 1 kg reduces knee stress by 4 kg!)\n• Strengthen quadriceps (they support the knee)\n• Wear proper footwear\n• Use ice for acute pain, heat for chronic\n• Don't sit cross-legged on floor\n\n🏠 **Indian Remedies**: Warm sesame oil massage, Turmeric milk, Methi seeds soaked in water, Epsom salt bath.\n\nJoint health supplements: Glucosamine, Collagen, Vitamin D, Omega-3.`;
}

function handlePregnancyFitness(name) {
  return `Pregnancy Fitness Guide for ${name}! 🤰\n\n⚠️ **ALWAYS consult your OB-GYN before starting or continuing exercise during pregnancy.**\n\n✅ **Safe Exercises**:\n• Walking (30 min daily)\n• Prenatal yoga\n• Swimming (great — water supports weight)\n• Pelvic floor exercises (Kegels)\n• Light stretching\n• Stationary cycling\n\n❌ **Avoid**:\n• Heavy weight lifting\n• Contact sports\n• Hot yoga/Bikram yoga\n• Lying flat on back after 20 weeks\n• High-impact exercises\n• Exercises with fall risk\n\n🥗 **Nutrition**:\n• Extra 300 cal/day in 2nd & 3rd trimester\n• Folic acid (green veggies, supplements)\n• Iron (spinach, jaggery, pomegranate)\n• Calcium (milk, curd, paneer)\n• Protein (dal, paneer, eggs)\n• DHA/Omega-3 (walnuts, flaxseed)\n\n💧 Stay extra hydrated — drink 3-4L water daily.\n\nExercise during pregnancy reduces gestational diabetes risk, improves mood, aids easier delivery, and speeds post-partum recovery.`;
}

function handleVegProtein(name, protein) {
  return `Vegetarian Protein Guide for ${name}! 🌱\n\n📊 **Your need: ${protein}g/day** — 100% achievable on vegetarian diet!\n\n🥗 **Top Veg Protein Sources** (per 100g):\n\n1. **Soybean/Soya chunks** — 52g protein! 🏆\n   Cheapest protein source in India (₹100/kg)\n   Recipe: Soya chunk curry, Soya keema\n\n2. **Peanuts** — 26g protein\n   Snack, Chutney, Peanut butter\n\n3. **Moong Dal** — 24g protein\n   Chilla, Dal, Sprouts\n\n4. **Chana (Chickpea)** — 19g protein\n   Chole, Roasted chana, Hummus\n\n5. **Paneer** — 18g protein\n   Bhurji, Tikka, Sabzi\n\n6. **Tofu** — 17g protein\n   Stir-fry, Bhurji style\n\n7. **Rajma** — 15g protein\n   Rajma chawal — complete protein with rice!\n\n8. **Greek Yogurt** — 10g protein\n   With fruits, as lassi\n\n9. **Quinoa** — 14g protein\n   Complete protein (all amino acids)\n\n10. **Sattu** — 20g protein\n    Bihar's superfood! Sattu drink, Sattu paratha\n\n📋 **Combination trick**: Rice + Dal = Complete protein (all amino acids covered). Traditional Indian thali is naturally balanced!\n\n💡 **Protein Math**:\n• 2 Moong dal chilla = 24g\n• 100g Paneer = 18g\n• 1 glass Milk = 8g\n• 50g Peanuts = 13g\n• 100g Soya chunks = 52g\n• Total = 115g protein — all vegetarian!\n\nWho says vegetarians can't get enough protein? 💪`;
}

function handleEggNutrition(name) {
  return `Egg Nutrition Guide for ${name}! 🥚\n\n📊 **1 Whole Egg**:\n• Calories: 78\n• Protein: 6g\n• Fat: 5g\n• Cholesterol: 186mg\n• Contains all 9 essential amino acids\n• Rich in Vitamin D, B12, Selenium\n\n📊 **Egg White only**:\n• Calories: 17\n• Protein: 3.6g\n• Fat: 0g\n• Pure protein, no cholesterol\n\n❓ **How many eggs per day?**\n• Healthy person: 2-3 whole eggs/day is safe\n• If cholesterol concern: 1 whole + extra whites\n• For muscle building: 2 whole + 4-5 whites = 30g protein\n\n🍳 **Best Ways to Eat**:\n1. Boiled (most nutritious — no added fat)\n2. Scrambled/Bhurji (add veggies for fiber)\n3. Omelette (with onion, tomato)\n4. Poached (low calorie)\n\n🔬 **Myth Busted**: \"Eggs increase cholesterol\" — Research shows dietary cholesterol has minimal impact on blood cholesterol for most people. Eggs are actually one of the healthiest foods on the planet.\n\n💡 Don't throw the yolk! It contains 50% of the protein and most of the nutrients (Vitamin D, B12, choline for brain health).`;
}

function handleMilkBenefits(name) {
  return `Milk Benefits for ${name}! 🥛\n\n📊 **1 Glass Milk (250ml)**:\n• Calories: 150\n• Protein: 8g\n• Calcium: 300mg (30% daily need)\n• Vitamin D, B12, Phosphorus\n\n🥛 **Types**:\n• **Full cream**: Best for weight gain, mass building\n• **Toned**: Balanced (recommended for most)\n• **Skimmed**: Best for weight loss (low fat)\n• **A2 Milk**: Easier to digest, from desi cows\n\n⏰ **Best Times**:\n• Morning: With breakfast for energy\n• Post-workout: Chocolate milk (natural recovery drink!)\n• Before bed: Warm milk + Turmeric (aids sleep + anti-inflammatory)\n\n🏠 **Healthy Milk Recipes**:\n• **Haldi doodh** (Golden milk): Milk + Turmeric + Black pepper + Honey\n• **Banana shake**: Milk + Banana + Oats + Peanut butter\n• **Badam milk**: Milk + Soaked almonds + Kesar + Elaichi\n\n⚠️ **Lactose intolerant?** Try: Curd (easier to digest), Buttermilk, Paneer, Almond milk, Soy milk\n\n🔬 **Research**: Warm milk before bed contains tryptophan, which converts to melatonin (sleep hormone). Haldi in milk adds curcumin which is anti-inflammatory.`;
}

function handleAyurveda(name) {
  return `Ayurveda & Fitness for ${name}! 🌿\n\n📖 **Ayurveda Basics**:\nIndia's 5000-year-old health science. Based on 3 body types (Doshas):\n\n🔥 **Vata** (Air + Space):\n• Body: Thin, light, dry skin, cold hands/feet\n• Diet: Warm, cooked foods. Ghee, Sesame oil, Soups\n• Avoid: Raw, cold foods. Beans in excess\n• Exercise: Gentle yoga, walking, swimming\n\n🔥 **Pitta** (Fire + Water):\n• Body: Medium build, warm body, sharp hunger\n• Diet: Cooling foods. Milk, Ghee, Coconut, Sweet fruits\n• Avoid: Spicy, sour, salty foods. Excess heat\n• Exercise: Swimming, moderate intensity. Avoid overheating\n\n🔥 **Kapha** (Earth + Water):\n• Body: Heavy build, slow metabolism, oily skin\n• Diet: Light, dry, warm foods. Honey, Ginger, Spices\n• Avoid: Heavy, oily, sweet foods. Dairy in excess\n• Exercise: Vigorous — running, HIIT, weight training\n\n🌿 **Ayurvedic Superfoods**:\n• Ashwagandha — Strength, stress relief, testosterone\n• Shilajit — Energy, stamina, anti-aging\n• Triphala — Digestion, detox, immunity\n• Brahmi — Brain, memory, focus\n• Tulsi — Immunity, respiratory health\n• Amla — Vitamin C, anti-aging, hair health\n\n⏰ **Ayurvedic Daily Routine** (Dinacharya):\n• Wake before sunrise\n• Oil pulling (coconut/sesame oil, 5 min)\n• Tongue scraping\n• Warm water with lemon\n• Exercise in morning\n• Largest meal at lunch (digestive fire is strongest)\n• Light dinner before sunset\n• Sleep by 10 PM\n\nWant to know your Dosha type or specific remedies?`;
}

function handleHomeRemedies(name) {
  return `Indian Home Remedies for ${name}! 🏠\n\n🍯 **Common Health Issues & Remedies**:\n\n**Cold & Cough**:\n• Haldi doodh (Turmeric milk) at bedtime\n• Ginger + Honey + Lemon in warm water\n• Kadha: Tulsi + Dalchini + Kali mirch + Honey\n• Steam inhalation with eucalyptus oil\n\n**Sore Throat**:\n• Warm salt water gargle (3x daily)\n• Mulethi (Licorice) chew\n• Honey + Ginger juice\n\n**Acidity/Gas**:\n• Jeera water (roasted cumin in warm water)\n• Ajwain + Black salt in warm water\n• Hing in warm water (instant relief)\n• Cold milk (neutralizes acid)\n\n**Headache**:\n• Peppermint oil on temples\n• Ginger tea\n• Clove oil application\n• Cold compress on forehead\n\n**Weight Loss**:\n• Warm lemon water morning\n• Green tea 2-3 cups/day\n• Apple cider vinegar (1 tsp in water before meals)\n• Methi water (soak overnight, drink morning)\n\n**Energy Boost**:\n• Sattu drink (roasted gram flour + water + lemon + black salt)\n• Jaggery + Peanuts\n• Coconut water + Nimbu\n\n**Better Sleep**:\n• Ashwagandha milk\n• Nutmeg (Jaiphal) pinch in warm milk\n• Chamomile tea\n\n⚠️ These are traditional remedies. For serious/persistent issues, consult a doctor.`;
}

function handleDetox(name, weight) {
  return `Detox Guide for ${name}! 🧹\n\n⚠️ **Truth**: Your liver and kidneys already detox your body 24/7. \"Detox diets\" are mostly marketing. But you CAN support your body's natural detox:\n\n💧 **3-Day Reset Plan**:\n\n**Day 1-3 Daily Routine**:\n🌅 Morning: Warm lemon water + Honey + Hing\n🥣 Breakfast: Fruits only — Papaya, Apple, Pomegranate\n🍵 Mid-morning: Green tea + 5 almonds\n🍛 Lunch: Khichdi with vegetables + Buttermilk\n☕ Evening: Coconut water + Makhana\n🍽️ Dinner: Vegetable soup + Dalia\n🌙 Bedtime: Triphala with warm water\n\n📋 **Rules**:\n• Drink ${Math.round(weight * 0.04)}L water daily\n• No sugar, processed food, maida\n• No caffeine, alcohol\n• No dairy (except buttermilk)\n• Eat only whole, natural foods\n\n🌿 **Detox Foods**:\n• Lemon — stimulates liver enzymes\n• Ginger — aids digestion\n• Turmeric — anti-inflammatory\n• Beetroot — blood purifier\n• Green leafy veggies — chlorophyll cleanses\n• Bottle gourd (Lauki) — kidney cleanser\n\n💡 **Better approach than \"detox\"**: Just eliminate processed food, sugar, and alcohol for 2 weeks. Your body does the rest!\n\nWant a longer clean eating plan?`;
}

function handleEnergy(name) {
  return `Energy Boosting Guide for ${name}! ⚡\n\n📋 **Instant Energy Hacks**:\n\n1. **Cold Water Splash** — Wakes up nervous system instantly\n2. **10 Jumping Jacks** — Gets blood flowing in 30 sec\n3. **Deep Breathing** — 5 deep breaths (oxygen boost)\n4. **Sunlight** — 10 min morning sun resets circadian rhythm\n5. **Cold Shower** — 30 sec cold water at end of shower\n\n🥗 **Energy Foods**:\n• **Banana** — Instant natural energy (potassium + natural sugars)\n• **Dates (Khajoor)** — Iron + natural sugar rush\n• **Nuts (Dry fruits)** — Sustained energy from healthy fats\n• **Jaggery (Gud)** — Better than sugar, provides iron\n• **Sattu drink** — Bihar's energy drink! High protein + minerals\n• **Black coffee** — 100mg caffeine = 90 min energy\n• **Dark chocolate** — Theobromine + caffeine + mood booster\n\n📋 **Root Causes of Low Energy**:\n1. **Dehydration** — #1 cause. Drink more water!\n2. **Poor sleep** — Fix sleep schedule\n3. **Iron deficiency** — Eat spinach, jaggery, pomegranate\n4. **Vitamin D deficiency** — Get 15 min sunlight daily\n5. **Sedentary lifestyle** — Exercise GIVES energy, not takes it\n6. **Too much sugar** — Causes crash. Switch to complex carbs\n7. **Stress** — Cortisol drains energy. Meditation helps\n\nWant to investigate what's specifically causing your fatigue?`;
}

function handleMotivation(name, goal) {
  return `Motivation Guide for ${name}! 🔥\n\n💪 **Remember Why You Started!**\n\nYour goal: ${goal.replace(/_/g, ' ').toUpperCase()}\n\n📋 **10 Motivation Hacks That Actually Work**:\n\n1. **Start Small** — 5 min workout > 0 min workout. Just START.\n2. **Track Progress** — Take photos every 2 weeks. You won't see daily changes, but monthly comparison is mind-blowing.\n3. **Don't Rely on Motivation** — Build DISCIPLINE. Motivation is a feeling; discipline is a decision.\n4. **Find Your Trigger** — Put gym clothes out the night before. Set alarm with workout playlist.\n5. **2-Minute Rule** — Tell yourself \"I'll just do 2 minutes.\" You'll always continue.\n6. **Accountability** — Tell a friend your goal. Or workout with a partner.\n7. **Reward System** — Week 1 done? New shoes. Month 1 done? New outfit.\n8. **Visualize** — Spend 2 min imagining your goal body. Brain can't tell imagination from reality.\n9. **Never Miss Twice** — Missed today? OK. Miss again tomorrow? NO. Never miss 2 in a row.\n10. **Remember**: Every single person in great shape was once a beginner who didn't quit.\n\n💭 **Quotes**:\n• \"The only bad workout is the one that didn't happen.\"\n• \"6 months from now, you'll wish you started today.\"\n• \"You don't have to be extreme, just consistent.\"\n\n🎯 **Fact**: It takes 21 days to form a habit, 90 days for a lifestyle change. You're ${goal === 'weight_loss' ? 'just weeks away from seeing your first visible results!' : 'building the foundation for an incredible transformation!'}\n\nYou got this, ${name}! 💪🔥`;
}

function handlePlateau(name, goal) {
  return `Breaking Through Plateau for ${name}! 📊\n\n**Why weight/progress stalls**:\nYour body adapts to your routine. Time to shock it!\n\n📋 **10 Plateau-Breaking Strategies**:\n\n1. **Calorie Cycling** — Eat different calories each day (1400, 1800, 1200, 1600...) instead of same daily\n2. **Change Workout** — Your body adapts in 4-6 weeks. Switch exercises completely\n3. **Add HIIT** — Replace 1-2 steady cardio sessions with HIIT\n4. **Increase Protein** — Extra 20-30g protein daily boosts metabolism\n5. **Refeed Day** — Eat at maintenance calories 1 day/week. Resets leptin hormone\n6. **Sleep More** — Poor sleep causes weight plateau. Aim 8 hours\n7. **Manage Stress** — High cortisol = weight stall. Try meditation\n8. **Try New Activity** — Swimming, cycling, dancing — anything different\n9. **Check Hidden Calories** — Cooking oil, chai sugar, snacks add up!\n10. **Be Patient** — Weight loss isn't linear. You might be losing fat but gaining muscle (same weight, smaller measurements!)\n\n🔬 **\"Whoosh Effect\"**: Sometimes body holds water for weeks, then suddenly drops 1-2 kg overnight. Trust the process!\n\n📏 **Better Metric**: Measure waist/hips with tape instead of just weight. Muscle weighs more than fat.\n\nDon't give up — plateaus mean your body is adapting. That's actually progress! 💪`;
}

function handleCheatMeal(name, goal) {
  return `Cheat Meal Guide for ${name}! 🍕\n\n✅ **Cheat meals are OKAY** — here's how to do it right:\n\n📋 **Rules**:\n• 1 cheat MEAL per week, not a cheat DAY\n• Choose one meal (lunch or dinner), not all day binge\n• Enjoy your favorite food guilt-free\n• Get back on track immediately after\n\n🍔 **Smart Cheat Choices**:\n• Pizza (2-3 slices) instead of full pizza\n• Chole Bhature (1 serving) — it's protein + carbs actually!\n• Biryani (1 plate) — better than processed junk\n• Paneer tikka with naan — high protein cheat\n• Dark chocolate instead of milk chocolate\n\n🔬 **Why Cheat Meals HELP**:\n• Resets leptin (hunger hormone) — boosts metabolism\n• Prevents diet fatigue — makes diet sustainable\n• Psychological relief — reduces cravings\n• Glycogen refill — better workout next day\n\n⚠️ **Avoid**:\n• Don't turn cheat meal into cheat week\n• Don't feel guilty — stress worse than the calories\n• Avoid alcohol with cheat meals (extra empty calories)\n• Don't cheat if you didn't follow diet all week\n\n💡 **Pro tip**: Schedule cheat meal on your heaviest workout day (legs/back day). Your body uses extra calories for recovery.\n\nEnjoy life, ${name} — fitness is a marathon, not a sprint! 🍕`;
}

function handleAlcohol(name, goal) {
  return `Alcohol & Fitness for ${name}! 🍺\n\n📊 **Hard Truth**: Alcohol is one of the biggest obstacles to fitness goals.\n\n🔬 **How Alcohol Hurts Fitness**:\n1. **Empty calories**: Beer = 150 cal, Vodka shot = 100 cal, Wine glass = 125 cal\n2. **Stops fat burning**: Body prioritizes metabolizing alcohol over fat. Fat burning stops for 24-48 hours!\n3. **Kills muscle**: Reduces protein synthesis by 20%. Lowers testosterone.\n4. **Dehydration**: Alcohol is a diuretic. Next day = poor performance.\n5. **Increases hunger**: Drunk munchies → pizza, kebabs, extra calories\n6. **Disrupts sleep**: Alcohol prevents deep sleep (REM).\n\n📋 **If You Do Drink** (harm reduction):\n• Maximum: 1-2 drinks per week\n• Best options: Red wine (antioxidants), Vodka + soda (lowest cal)\n• Worst: Beer (high carbs), Cocktails (massive sugar)\n• Eat protein before drinking (slows absorption)\n• Drink water between alcoholic drinks\n• Don't skip workout next day — sweat it out\n\n🎯 **For ${goal.replace(/_/g, ' ')}**:\n${goal === 'weight_loss' ? 'Cut alcohol completely for fastest results. Those 500 cal from weekend drinks = 2 kg extra per month!' : goal === 'weight_gain' ? 'Alcohol reduces testosterone and muscle growth. Limit to 1 drink/week max.' : 'Moderate occasional drinking is okay, but know it slows progress.'}\n\n💡 **Alternatives**: Mocktails, Kombucha, Sparkling water with lime, Virgin mojito.`;
}

function handleSugar(name) {
  return `Sugar Guide for ${name}! 🍬\n\n📊 **Sugar = Silent Killer**\n\nWHO recommendation: Max 25g (6 tsp) added sugar/day\nAverage Indian consumes: 50-70g/day! (Double the limit)\n\n🔬 **What Sugar Does**:\n• Spikes insulin → body stores fat (especially belly fat)\n• Causes energy crash 2 hours after eating\n• Addictive (activates same brain centers as drugs)\n• Causes inflammation, acne, aging\n• Feeds harmful gut bacteria\n• Linked to diabetes, heart disease, cancer\n\n📋 **Hidden Sugar in Indian Food**:\n• 1 cup chai with sugar = 10g sugar\n• Biscuits (4 pcs) = 12g\n• Fruit juice (1 glass) = 25g!\n• Flavored yogurt = 18g\n• Ketchup (1 tbsp) = 4g\n\n✅ **Healthy Alternatives**:\n• **Jaggery (Gud)** — Contains iron, minerals (still use in moderation)\n• **Honey** — Antimicrobial, lower GI than sugar\n• **Stevia** — Zero calorie natural sweetener\n• **Dates (Khajoor)** — Natural sweetener with fiber\n• **Fruits** — Natural sugar WITH fiber (slows absorption)\n\n💡 **Quit Sugar in 21 Days**:\n• Week 1: Replace sugar in tea/coffee with stevia\n• Week 2: Replace packaged snacks with fruits/nuts\n• Week 3: No desserts except dark chocolate\n• After 21 days: Cravings disappear. Sweet things taste TOO sweet!\n\nSugar cravings? Eat a banana or dates — natural sugar without the crash.`;
}

function handleRiceMyth(name, goal) {
  return `Rice vs Roti — The Truth for ${name}! 🍚\n\n📊 **Comparison** (per 100g cooked):\n\n| | Rice | Roti |\n|------|------|------|\n| Calories | 130 | 264 |\n| Protein | 2.7g | 8.7g |\n| Carbs | 28g | 50g |\n| Fiber | 0.4g | 3.4g |\n| GI Index | 73 (High) | 62 (Medium) |\n\n🔬 **The Verdict**: BOTH are fine in moderation!\n\n**Rice is NOT bad because**:\n• 2 billion Asians eat rice daily and are healthy\n• South Indians eat rice 3 meals/day and have lower obesity rates than North Indians!\n• Rice is easily digestible — good post-workout\n• Brown rice has more fiber and nutrients\n\n**Roti is better when**:\n• You want more protein and fiber per serving\n• Weight loss — keeps you fuller longer\n• Blood sugar management — lower GI\n\n📋 **Smart Choices**:\n${goal === 'weight_loss' ? '• Limit to 1 katori rice OR 2 roti per meal\n• Switch to brown rice / hand-pounded rice\n• Eat rice at lunch (not dinner)\n• Add dal/sabzi with rice for balanced meal' : '• Eat both! 2-3 roti + 1 katori rice at lunch\n• White rice post-workout for fast carb replenishment\n• Do not fear carbs — they fuel workouts'}\n\n💡 **Pro tip**: Cold rice has resistant starch (less calories absorbed). Day-old rice is technically better for weight loss! Rajma chawal is a complete protein meal.\n\nRice doesn't make you fat — EXCESS calories make you fat!`;
}

function handleGheeBenefits(name) {
  return `Ghee Guide for ${name}! 🧈\n\n📊 **1 tbsp Ghee**: 120 cal, 14g fat, Vitamins A/D/E/K\n\n✅ **Benefits of Desi Ghee**:\n1. Rich in Omega-3 fatty acids\n2. Contains CLA (Conjugated Linoleic Acid) — aids fat loss!\n3. High smoke point — safest oil for Indian cooking\n4. Aids vitamin absorption (fat-soluble vitamins)\n5. Anti-inflammatory (butyric acid)\n6. Lubricates joints\n7. Boosts digestion (stimulates bile)\n8. Ancient Ayurvedic superfood\n\n🔬 **Myth Busted**: \"Ghee makes you fat\" — FALSE!\n• 1-2 tbsp/day is actually HEALTHY\n• Studies show moderate ghee consumption doesn't increase cholesterol\n• It's the excessive refined oils and processed food that cause problems\n\n📋 **How to Use**:\n• Add 1 tsp to dal or rice\n• Cook rotis with ghee\n• Bulletproof coffee: Coffee + 1 tsp ghee + blend\n• Warm milk + ghee + turmeric (bedtime drink)\n\n⚠️ **Limit**: 2 tbsp (30g) per day for active people. Reduce to 1 tbsp if sedentary.\n\n🐄 **Best type**: Desi cow (A2) ghee, homemade > packaged. Bilona method ghee is premium quality.`;
}

function handlePaneerNutrition(name) {
  return `Paneer Guide for ${name}! 🧀\n\n📊 **Per 100g Paneer**:\n• Calories: 265\n• Protein: 18g\n• Fat: 20g\n• Calcium: 480mg (highest among foods!)\n• Casein protein (slow-digesting — great before bed)\n\n🥗 **Best Paneer Recipes for Fitness**:\n1. **Paneer Bhurji** — Scrambled paneer with veggies (high protein breakfast)\n2. **Palak Paneer** — Iron + Protein combo\n3. **Paneer Tikka** — Grilled, low fat, high protein\n4. **Paneer Salad** — Raw paneer cubes + veggies + lemon\n5. **Paneer Wrap** — Whole wheat roti + paneer + veggies\n\n💡 **Low-fat version**: Make paneer from toned milk instead of full cream.\n\n📊 **How much per day**: 100-200g paneer = 18-36g protein. Perfect for vegetarians!\n\n🔬 Paneer is India's answer to cottage cheese. It has casein protein which digests slowly over 6-8 hours — perfect for before bed to prevent muscle breakdown during sleep.`;
}

function handleChickenNutrition(name) {
  return `Chicken Guide for ${name}! 🍗\n\n📊 **Per 100g**:\n\n| Cut | Calories | Protein | Fat |\n|-----|----------|---------|-----|\n| Breast (skinless) | 165 | 31g | 3.6g |\n| Thigh (skinless) | 209 | 26g | 10g |\n| Drumstick | 172 | 28g | 5.7g |\n| Wings | 203 | 30g | 8g |\n\n🍗 **Best for Fitness**: Chicken Breast — highest protein, lowest fat\n\n🥗 **Healthy Chicken Recipes**:\n1. **Grilled Chicken Breast** — Marinate in curd + spices, grill\n2. **Chicken Salad** — Shredded chicken + veggies + olive oil\n3. **Chicken Soup** — Boiled chicken + veggies (recovery meal)\n4. **Tandoori Chicken** — Yogurt marinated, baked (low fat)\n5. **Chicken Curry** — With minimal oil, tomato-based gravy\n\n💡 **Tips**:\n• Remove skin — saves 100+ calories per piece\n• Bake/Grill/Boil > Fry\n• Marinate in curd for tender + probiotic benefit\n• Post-workout: 150g chicken breast = 46g protein!\n\n⚠️ **Avoid**: Fried chicken, Butter chicken (restaurant style — loaded with cream), Chicken nuggets (processed).\n\nFor muscle building, chicken breast is the gold standard! 💪`;
}

function handleOatsRecipes(name) {
  return `Oats Recipes for ${name}! 🥣\n\n📊 **Per 100g Oats**: 389 cal | 17g protein | 66g carbs | 11g fiber\nSlow-releasing carbs — keeps you full for 3-4 hours!\n\n🥗 **5 Healthy Oats Recipes**:\n\n1. **Overnight Oats** (No cooking!)\n   Oats + Milk + Chia seeds + Banana + Honey\n   Keep in fridge overnight. Ready by morning!\n\n2. **Masala Oats (Indian style)**\n   Roast oats → Add onion, tomato, peas, carrot\n   Season with turmeric, cumin, green chili\n   Tastes like upma!\n\n3. **Oats Smoothie**\n   Blend: Oats + Banana + Milk + Peanut butter + Honey\n   Perfect post-workout shake (450 cal, 20g protein)\n\n4. **Oats Chilla**\n   Grind oats → Mix with besan + onion + spices → Make chilla\n   High protein Indian breakfast!\n\n5. **Oats Kheer**\n   Cook oats in milk → Add dates + cardamom + nuts\n   Healthy dessert option!\n\n💡 **Best type**: Steel-cut oats > Rolled oats > Instant oats (less processed = more fiber).\n\nOats are one of the best breakfast options for any fitness goal!`;
}

function handleSmoothieRecipes(name, goal, dietPref) {
  return `Healthy Smoothie Recipes for ${name}! 🥤\n\n**1. Fat Burning Green Smoothie** (200 cal)\n• Spinach + Cucumber + Apple + Ginger + Lemon + Water\n\n**2. Muscle Builder Shake** (500 cal)\n• Banana + Oats + Milk + Peanut butter + Whey protein + Honey\n\n**3. Post-Workout Recovery** (350 cal)\n• Banana + Yogurt + Berries + Honey + Ice\n\n**4. Indian Protein Lassi** (300 cal)\n• Curd + Banana + Honey + Cardamom + Almonds (blend)\n\n**5. Energy Booster** (250 cal)\n• Dates (5) + Milk + Walnuts + Kesar + Cocoa powder\n\n**6. Detox Smoothie** (150 cal)\n• Beetroot + Carrot + Apple + Ginger + Lemon\n\n**7. Sleep Smoothie** (200 cal)\n• Warm milk + Banana + Almond butter + Turmeric + Honey\n\n💡 **Tips**: \n• Use frozen banana for thick, creamy texture (no ice needed)\n• Add chia/flax seeds for Omega-3\n• Drink immediately — nutrients oxidize quickly\n${goal === 'weight_loss' ? '• Use water instead of milk to cut calories' : '• Use full cream milk + extra nut butter for more calories'}\n\nWant more recipes for specific goals?`;
}

function handleSixPack(name, bmi) {
  return `Six Pack Guide for ${name}! 🔥\n\n⚠️ **Hard Truth**: Six pack abs are 70% diet, 20% cardio, 10% ab exercises.\n\n📊 **Your BMI: ${bmi}**\n${bmi > 20 ? 'You need to get body fat below 12-15% for visible abs.' : 'You\'re lean! Focus on ab exercises + slight calorie surplus for muscle.'}\n\n📋 **The Formula**:\n1. **Calorie deficit** — Must lose belly fat first (can't spot-reduce!)\n2. **High protein** — Preserves muscle while losing fat\n3. **Cardio** — Burns the fat layer covering abs\n4. **Ab training** — Builds the muscle underneath\n5. **Patience** — Takes 3-6 months of consistency\n\n🏋️ **Ab Workout** (4-5x/week):\n• Hanging Leg Raises: 3x12\n• Cable Crunches: 3x15\n• Bicycle Crunches: 3x20\n• Plank: 3x60 sec\n• Mountain Climbers: 3x30 sec\n• Ab Wheel Rollout: 3x10\n\n🔬 **Science**: Everyone HAS abs. They're just hidden under fat. Body fat targets:\n• Men: < 12% = visible abs, < 10% = shredded\n• Women: < 18% = visible abs, < 16% = defined\n\n💡 **Timeline**: If you're at 20% body fat, expect 3-4 months to see abs with strict diet + exercise. If 25%+, expect 5-6 months.\n\nNo shortcut exists. Consistency + patience = six pack! 💪`;
}

function handleRunning(name, weight) {
  const calPerKm = Math.round(weight * 1.036);
  return `Running Guide for ${name}! 🏃\n\n📊 **Calories burned**: ~${calPerKm} cal/km (based on your ${weight}kg weight)\n\n📋 **Beginner Plan** (Couch to 5K in 8 weeks):\n• Week 1-2: Walk 5 min → Jog 1 min → Walk 1 min (repeat 10x)\n• Week 3-4: Walk 3 min → Jog 3 min (repeat 6x)\n• Week 5-6: Walk 2 min → Jog 5 min (repeat 4x)\n• Week 7-8: Jog 25-30 min continuously\n\n🏃 **Tips**:\n• Start SLOW — conversational pace\n• Breathe rhythmically (2 steps inhale, 2 steps exhale)\n• Land on midfoot, not heel\n• Invest in proper running shoes (₹3000-5000)\n• Run on grass/track, not concrete\n• Stretch AFTER running, not before\n\n⏰ **Best Time**: Morning (empty stomach for fat burn) or Evening (performance is better)\n\n⚠️ **Avoid**: Running daily (rest days important), Ignoring pain, Running too fast too soon\n\n🔬 **Benefits**: Burns more calories than most exercises, improves heart health, releases endorphins (runner's high), improves sleep, reduces stress.\n\nWant a specific training plan for 5K/10K?`;
}

function handleWalking(name, weight) {
  const calPer10k = Math.round(weight * 0.04 * 100);
  return `Walking Guide for ${name}! 🚶\n\n📊 **10,000 steps = ~${calPer10k} calories burned** (for ${weight}kg)\n\n✅ **Benefits of Walking**:\n• Burns fat (especially belly fat) without muscle loss\n• Lowest injury risk of all exercises\n• Reduces stress and anxiety\n• Improves digestion (walk after meals!)\n• Lowers blood pressure and blood sugar\n• No equipment needed\n\n📋 **How to Get 10K Steps**:\n• Morning walk: 3000 steps (20-30 min)\n• Walk after lunch: 2000 steps (15 min)\n• Walk after dinner: 2000 steps (15 min)\n• Daily activities: 3000 steps\n\n💡 **Tips to Walk More**:\n• Take stairs instead of elevator\n• Walk while on phone calls\n• Park car far from entrance\n• Walk to nearby shops instead of driving\n• Walking meetings\n\n🔬 **Research**: Walking 30 min after meals reduces blood sugar spike by 30%. A 15-min walk after dinner improves digestion dramatically.\n\n⚡ **Power Walking**: Walk fast (6-7 km/h) and swing arms. Burns 40% more calories than normal walking!\n\nSimple, free, and incredibly effective. Start today! 🚶`;
}

function handleSwimming(name) {
  return `Swimming Guide for ${name}! 🏊\n\n📊 **Calories burned**: 400-700 cal/hour (depends on intensity)\nOne of the best full-body exercises that exists!\n\n✅ **Benefits**:\n• Full body workout — works ALL muscle groups\n• Zero impact on joints (great for knee/back pain)\n• Burns massive calories\n• Builds lean muscle + endurance\n• Improves lung capacity\n• Great for stress relief\n• Excellent for height growth (stretches entire body)\n\n🏊 **Strokes & Their Benefits**:\n1. **Freestyle** — Best for overall fitness + speed\n2. **Backstroke** — Great for back muscles + posture\n3. **Breaststroke** — Chest + inner thighs\n4. **Butterfly** — Most intense calorie burner (shoulders + core)\n\n📋 **Beginner Plan**:\n• Week 1-2: 20 min, freestyle + backstroke, rest between laps\n• Week 3-4: 30 min, add breaststroke\n• Week 5+: 45 min, mix all strokes, reduce rest\n\n💡 Swim 3-4 times per week for best results. Complement with strength training on non-swim days.\n\n⚠️ Swimming alone won't build significant muscle mass. Combine with weight training for best physique.`;
}

function handleCycling(name, weight) {
  return `Cycling Guide for ${name}! 🚴\n\n📊 **Calories**: ~${Math.round(weight * 7.5)} cal/hour at moderate pace\n\n✅ **Benefits**: Low impact, great for legs, burns fat, improves heart health, eco-friendly transport!\n\n📋 **Beginner Plan**:\n• Week 1-2: 15-20 min, flat terrain, comfortable pace\n• Week 3-4: 25-30 min, slight inclines\n• Week 5+: 30-45 min, mix of flat + hills\n\n🦵 **Muscles Worked**: Quads, Hamstrings, Calves, Glutes, Core\n\n💡 **Tips**:\n• Adjust seat height — leg should be almost straight at bottom of pedal\n• Start easy, build up speed gradually\n• Hydrate during ride\n• Cycle to work/college if possible — exercise + commute\n\n🔬 Cycling at moderate intensity for 30 min, 5x/week can reduce body fat by 5-10% in 3 months!\n\nIndoor option: Stationary bike at gym is equally effective.`;
}

function handleWarmUp(name) {
  return `Warm-Up Routine for ${name}! 🔥\n\n⏰ **5-10 min before every workout** (NEVER skip!)\n\n1. **Jumping Jacks** — 30 sec (raises heart rate)\n2. **Arm Circles** — 20 each direction (shoulder mobility)\n3. **Leg Swings** — 10 each leg (hip mobility)\n4. **Hip Circles** — 10 each direction\n5. **High Knees** — 30 sec (activates legs)\n6. **Torso Twists** — 10 each side (spine mobility)\n7. **Bodyweight Squats** — 10 reps (activates glutes)\n8. **Arm Cross Swings** — 10 reps (chest opener)\n\n🔬 **Why Warm-Up Matters**:\n• Increases blood flow to muscles by 30%\n• Raises muscle temperature — better performance\n• Reduces injury risk by 50%!\n• Mentally prepares you for workout\n• Activates nervous system for better mind-muscle connection\n\n⚠️ **NO static stretching before workout** — save that for cool-down. Dynamic movements only before exercise.`;
}

function handleCoolDown(name) {
  return `Cool-Down Routine for ${name}! 🧊\n\n⏰ **5-10 min after every workout**\n\n1. **Walk** — 2-3 min (gradually lower heart rate)\n2. **Quad Stretch** — 30 sec each leg\n3. **Hamstring Stretch** — 30 sec each leg\n4. **Chest Stretch** (doorway) — 30 sec\n5. **Shoulder Stretch** — 30 sec each arm\n6. **Cat-Cow** — 10 reps (spine decompression)\n7. **Child's Pose** — 60 sec (full body relax)\n8. **Deep Breathing** — 5 deep breaths\n\n✅ **Benefits**: Reduces muscle soreness, prevents dizziness, improves flexibility, aids recovery, brings heart rate to normal gradually.\n\nNever just stop and sit after intense exercise!`;
}

function handleInjuryPrevention(name) {
  return `Injury Prevention for ${name}! 🏥\n\n📋 **Top 10 Rules**:\n\n1. **Always warm up** — 5-10 min (non-negotiable!)\n2. **Learn proper form** — Bad form = guaranteed injury. Watch videos, ask trainers.\n3. **Progressive overload** — Increase weight by max 10% per week\n4. **Don't ego lift** — Lighter weight with good form > Heavy with bad form\n5. **Rest days** — Muscles GROW during rest, not during exercise\n6. **Listen to your body** — Sharp pain = STOP immediately. Muscle burn = OK\n7. **Stay hydrated** — Dehydration increases cramp and injury risk\n8. **Sleep enough** — Fatigue = poor coordination = injury\n9. **Stretch after workouts** — Improves flexibility, prevents stiffness\n10. **Balanced training** — Don't skip muscle groups. Imbalances cause injuries.\n\n⚠️ **Red Flags** (see doctor):\n• Sharp, shooting pain\n• Joint popping with pain\n• Swelling that doesn't go down\n• Pain that worsens over days\n• Numbness or tingling\n\n💡 **RICE Method** (for minor injuries):\nRest → Ice → Compression → Elevation`;
}

function handleBodyType(name, bmi, weight, height) {
  let type, desc;
  if (bmi < 20) { type = 'Ectomorph'; desc = 'Naturally thin, fast metabolism, hard to gain weight'; }
  else if (bmi < 25) { type = 'Mesomorph'; desc = 'Athletic build, gains muscle easily, moderate metabolism'; }
  else { type = 'Endomorph'; desc = 'Larger frame, slower metabolism, gains weight easily'; }

  return `Body Type Analysis for ${name}! 🧬\n\n📊 Based on your stats (${height}cm, ${weight}kg, BMI ${bmi}):\n\n**Your likely body type: ${type}**\n${desc}\n\n📋 **3 Body Types**:\n\n🦴 **Ectomorph** (Hardgainer):\n• Thin frame, long limbs, fast metabolism\n• Strategy: Calorie surplus (+500), compound lifts, limit cardio\n• Eat MORE, lift HEAVY, sleep LOTS\n\n💪 **Mesomorph** (Lucky genes):\n• Athletic, muscular build naturally\n• Strategy: Balanced training works great. Respond well to everything\n• Any workout plan + balanced diet = results\n\n🐻 **Endomorph** (Easy gainer):\n• Wider frame, stores fat easily\n• Strategy: Calorie deficit, high protein, cardio + weights\n• Watch portions, more cardio, less carbs at night\n\n⚠️ **Note**: Most people are a MIX of types. These are guidelines, not limitations. Any body type can achieve any physique with the right approach!\n\n🔬 Your body type determines your starting point, NOT your destination.\n\nWant a training plan specific to your body type?`;
}

function handleMetabolism(name, bmr, age) {
  return `Metabolism Guide for ${name}! ⚡\n\n📊 **Your BMR: ${bmr} cal/day**\n(Calories your body burns at complete rest — breathing, digestion, cell repair)\n\n📋 **How to BOOST Metabolism**:\n\n1. **Build Muscle** — 1 kg muscle burns 50 cal/day at rest. More muscle = faster metabolism\n2. **HIIT** — Burns calories for 24 hours AFTER workout (EPOC effect)\n3. **Eat Enough Protein** — Body burns 25% of protein calories during digestion (vs 5% for carbs)\n4. **Don't Skip Meals** — Starvation mode slows metabolism\n5. **Cold Exposure** — Cold showers activate brown fat (calorie burning)\n6. **Green Tea/Coffee** — Caffeine boosts metabolism 3-11%\n7. **Spicy Food** — Capsaicin in chilies temporarily boosts metabolism\n8. **Sleep 7-8 Hours** — Poor sleep reduces metabolism 5-20%\n9. **Stay Active** — NEAT (walking, fidgeting, stairs) burns 200-500 cal/day\n10. **Drink Cold Water** — Body burns calories warming it up\n\n🔬 **Metabolism Facts**:\n• Decreases ~2% per decade after 30\n• ${age > 30 ? 'At your age, focus on strength training to maintain metabolic rate' : 'Your metabolism is still at its peak!'}\n• Crash diets DESTROY metabolism. Never eat below BMR\n• Muscle is the #1 factor you can control\n\n💡 **Metabolic Adaptation**: If you've been dieting long, take 1-2 weeks at maintenance calories. This \"resets\" metabolism.\n\nWant a metabolism-boosting meal plan?`;
}

function handleThankYou(name) {
  const responses = [
    `You're welcome, ${name}! 😊 Keep pushing towards your goals. I'm always here when you need health advice! 💪`,
    `Happy to help, ${name}! 🙏 Remember — consistency is the key to transformation. You got this! 🔥`,
    `Anytime, ${name}! 😊 Stay motivated, stay healthy. Come back whenever you have questions! 💪`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function handleGoodbye(name) {
  return `Goodbye ${name}! 👋\n\nRemember:\n• Stay hydrated 💧\n• Get good sleep 😴\n• Stay consistent 🔥\n• Don't skip meals 🥗\n\nI'm here 24/7 whenever you need health advice. Take care and keep crushing your goals! 💪🏆`;
}

function handleWhoAreYou(name) {
  return `I'm FitAI — your personal AI Health & Fitness Coach! 🤖💪\n\n📋 **What I can help with**:\n\n🥗 **Nutrition**: Indian & International diet plans, calorie counting, macro tracking, food comparisons, recipes\n\n🏋️ **Workouts**: Home & gym plans, muscle-specific exercises, yoga, cardio, HIIT\n\n📊 **Health Analysis**: BMI, body fat, metabolism, body type assessment\n\n💊 **Supplements**: Whey protein, creatine, vitamins, Ayurvedic supplements\n\n🧘 **Wellness**: Sleep, stress, meditation, immunity, skin/hair health\n\n🏥 **Health Conditions**: Diabetes diet, Thyroid management, PCOS, Heart health, Joint pain\n\n🔬 **Science-Based**: All my advice is backed by nutrition science and sports research\n\nI personalize everything based on YOUR profile — your weight, height, goals, and preferences!\n\nJust ask me anything! 😊`;
}

function handleHelp(name) {
  return `Here's what you can ask me, ${name}! 📋\n\n**Popular Questions**:\n• \"How to lose weight fast?\"\n• \"Indian diet plan for muscle gain\"\n• \"Best chest exercises\"\n• \"How much protein do I need?\"\n• \"Home workout plan\"\n• \"What is intermittent fasting?\"\n• \"How to get six pack abs?\"\n• \"Keto diet guide\"\n• \"Benefits of yoga\"\n• \"How to sleep better?\"\n• \"Supplement guide\"\n• \"Height increase tips\"\n• \"PCOS diet plan\"\n• \"Diabetes-friendly food\"\n• \"Home remedies for cold\"\n• \"Smoothie recipes\"\n• \"Running for beginners\"\n\n💡 You can ask in **Hindi or English** — I understand both!\n\nJust type your question and I'll give you a detailed, personalized answer! 🔥`;
}

function handleDefault(name, weight, protein, goal) {
  const tips = [
    `Great question, ${name}! Let me share some personalized tips for your ${goal.replace(/_/g, ' ')} goal:\n\n1. 💧 Drink ${Math.round(weight * 0.033)}L water daily\n2. 🥩 Eat ${protein}g protein daily\n3. 🏃 Exercise 30-45 min daily\n4. 😴 Sleep 7-8 hours\n5. 🧘 Practice 10 min meditation\n6. 🥗 Eat whole, unprocessed foods\n7. 📊 Track your progress weekly\n\n**Try asking me about**:\n• Specific diet plans (Indian/International)\n• Workout routines (Home/Gym)\n• Any body part exercises\n• Health conditions\n• Supplements\n• Recipes & food tips\n• Yoga & meditation\n\nI'm your 24/7 health coach — ask me anything! 💪`,
    `Here's your daily health checklist, ${name}! ✅\n\n☐ Drink ${Math.round(weight * 0.033)}L water\n☐ Eat ${protein}g protein\n☐ 30 min exercise\n☐ 10,000 steps\n☐ 7-8 hours sleep\n☐ Take Vitamin D (sunlight 15 min)\n☐ Eat 5 servings vegetables/fruits\n☐ Limit screen time before bed\n\n**Random Health Fact**: ${getRandomHealthFact()}\n\nAsk me something specific — I can give much more detailed advice! 💪`,
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function getRandomHealthFact() {
  const facts = [
    'Walking after meals reduces blood sugar spikes by 30%.',
    'Muscle burns 3x more calories at rest than fat tissue.',
    'Your brain is 75% water — dehydration causes brain fog and headaches.',
    'Laughing for 15 minutes burns 40 calories.',
    'Turmeric absorption increases 2000% when combined with black pepper.',
    'Cold showers activate brown fat, which burns calories to generate heat.',
    'Sleep deprivation makes you crave junk food by 45% more than normal.',
    'Your gut has 100 trillion bacteria — more than cells in your body!',
    'Dark chocolate (70%+) has more antioxidants than blueberries.',
    'Just 10 minutes of meditation can reduce anxiety by 60%.',
    'India has the highest number of vegetarians in the world — and many are incredibly fit!',
    'Ashwagandha has been shown to increase testosterone by 15-17% in studies.',
    'Coconut water has the same electrolyte balance as human blood plasma.',
    'Your body can absorb only 25-40g protein per meal. Spread intake throughout the day.',
    'Eating slowly (20+ minutes per meal) reduces calorie intake by 10-15%.',
  ];
  return facts[Math.floor(Math.random() * facts.length)];
}

module.exports = exports;
