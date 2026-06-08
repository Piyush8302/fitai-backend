// ─── Hindi / common alias → English mapping ────────────────────────────────
const HINDI_ALIASES = {
  // Grains
  roti: 'roti', chapati: 'roti', chapatti: 'roti', phulka: 'roti', fulka: 'roti',
  chawal: 'rice', chaawal: 'rice', bhaat: 'rice',
  paratha: 'paratha', parathe: 'paratha', pratha: 'paratha',
  naan: 'naan', nan: 'naan',
  puri: 'puri', poori: 'puri',
  bhatura: 'bhatura', bhatoora: 'bhatura',
  thepla: 'thepla',
  // Dals / Pulses
  dal: 'dal', daal: 'dal', dhal: 'dal',
  rajma: 'rajma', rajmah: 'rajma',
  chole: 'chole', chhole: 'chole', chana: 'chole', chane: 'chole', chickpea: 'chole',
  moong: 'moong', mung: 'moong',
  masoor: 'masoor',
  urad: 'urad dal',
  sprout: 'sprouts', ankurit: 'sprouts',
  // Dairy
  paneer: 'paneer', paner: 'paneer', 'cottage cheese': 'paneer',
  dahi: 'curd', yogurt: 'curd', curd: 'curd', raita: 'raita',
  ghee: 'ghee', butter: 'ghee',
  lassi: 'lassi',
  milk: 'milk', dudh: 'milk', doodh: 'milk',
  chaas: 'buttermilk', chhaas: 'buttermilk', mattha: 'buttermilk',
  // Vegs
  aloo: 'potato', aaloo: 'potato', potato: 'potato',
  gobi: 'cauliflower', gobhi: 'cauliflower', cauliflower: 'cauliflower',
  palak: 'spinach', spinach: 'spinach',
  bhindi: 'okra', bhendi: 'okra', okra: 'okra', ladyfinger: 'okra',
  baingan: 'brinjal', baigan: 'brinjal', brinjal: 'brinjal', eggplant: 'brinjal',
  tamatar: 'tomato', tomato: 'tomato',
  pyaaz: 'onion', pyaj: 'onion', onion: 'onion',
  gajar: 'carrot', carrot: 'carrot',
  kheera: 'cucumber', kakdi: 'cucumber', cucumber: 'cucumber',
  matar: 'peas', peas: 'peas',
  shimla: 'capsicum', capsicum: 'capsicum',
  lauki: 'bottle gourd', ghiya: 'bottle gourd',
  tori: 'ridge gourd', turai: 'ridge gourd',
  karela: 'bitter gourd', bitter: 'bitter gourd',
  makka: 'corn', corn: 'corn', bhutta: 'corn',
  shakarkandi: 'sweet potato',
  // Fruits
  aam: 'mango', mango: 'mango', keri: 'mango',
  kela: 'banana', banana: 'banana',
  seb: 'apple', apple: 'apple',
  santra: 'orange', santara: 'orange', orange: 'orange',
  angoor: 'grapes', angur: 'grapes', grapes: 'grapes',
  anar: 'pomegranate', pomegranate: 'pomegranate',
  tarbooz: 'watermelon', tarbuj: 'watermelon', watermelon: 'watermelon',
  papita: 'papaya', papaya: 'papaya',
  nashpati: 'pear', pear: 'pear',
  amrood: 'guava', guava: 'guava',
  chikoo: 'sapota', sapota: 'sapota', chiku: 'sapota',
  litchi: 'lychee', lychee: 'lychee', lichi: 'lychee',
  ananas: 'pineapple', pineapple: 'pineapple',
  jamun: 'jamun', 'java plum': 'jamun',
  strawberry: 'strawberry',
  // Non-veg
  chicken: 'chicken', murgh: 'chicken', murga: 'chicken',
  egg: 'egg', anda: 'egg', ande: 'egg',
  fish: 'fish', machli: 'fish', machhi: 'fish',
  mutton: 'mutton', gosht: 'mutton', meat: 'mutton',
  prawn: 'prawn', jhinga: 'prawn', shrimp: 'prawn',
  keema: 'keema', qeema: 'keema', mince: 'keema',
  // Snacks
  samosa: 'samosa',
  pakoda: 'pakora', pakora: 'pakora', bhajiya: 'pakora',
  maggi: 'maggi', noodles: 'maggi',
  pizza: 'pizza',
  burger: 'burger',
  momos: 'momos', momo: 'momos', dumpling: 'momos',
  chaat: 'chaat',
  dhokla: 'dhokla',
  // Breakfast
  idli: 'idli', idly: 'idli',
  dosa: 'dosa', dosai: 'dosa',
  poha: 'poha', pohe: 'poha',
  upma: 'upma',
  uttapam: 'uttapam',
  // Desserts
  jalebi: 'jalebi',
  gulab: 'gulab jamun', 'gulab jamun': 'gulab jamun',
  kheer: 'kheer', payasam: 'kheer',
  halwa: 'halwa', halva: 'halwa',
  ladoo: 'ladoo', laddoo: 'ladoo', laddu: 'ladoo',
  barfi: 'barfi', burfi: 'barfi',
  rasgulla: 'rasgulla', rasagulla: 'rasgulla',
  // Beverages
  chai: 'chai', tea: 'chai',
  coffee: 'coffee',
  nimbu: 'lemon water', 'nimbu pani': 'lemon water', shikanji: 'lemon water',
  nariyal: 'coconut water', 'coconut water': 'coconut water',
  jaljeera: 'jaljeera',
  // Nuts / Seeds
  badam: 'almond', almond: 'almond',
  kaju: 'cashew', cashew: 'cashew',
  akhrot: 'walnut', walnut: 'walnut',
  mungfali: 'peanut', moongfali: 'peanut', peanut: 'peanut',
  pista: 'pistachio', pistachio: 'pistachio',
  // More Vegetables (Hindi)
  kathal: 'jackfruit', jackfruit: 'jackfruit',
  arbi: 'taro', arvi: 'taro', taro: 'taro',
  suran: 'yam', jimikand: 'yam', yam: 'yam',
  saag: 'saag', sarson: 'saag', 'sarson ka saag': 'saag',
  methi: 'fenugreek', fenugreek: 'fenugreek',
  kaddu: 'pumpkin', sitafal: 'pumpkin', pumpkin: 'pumpkin',
  parval: 'pointed gourd', parwal: 'pointed gourd',
  sem: 'beans', beans: 'beans', 'french beans': 'beans',
  chaulai: 'amaranth', rajgira: 'amaranth',
  'kachcha kela': 'raw banana', 'raw banana': 'raw banana',
  sahjan: 'drumstick', drumstick: 'drumstick', moringa: 'drumstick',
  // More misc
  soya: 'soya', tofu: 'tofu', 'soy chunk': 'soya chunks',
  protein: 'whey protein', whey: 'whey protein',
  oats: 'oats', daliya: 'oats', dalia: 'oats',
  atta: 'wheat flour', maida: 'refined flour', besan: 'gram flour',
  suji: 'semolina', sooji: 'semolina', rava: 'semolina',
  popcorn: 'popcorn', makhana: 'fox nuts', 'fox nut': 'fox nuts',
  murmura: 'puffed rice', 'puffed rice': 'puffed rice',
  chivda: 'mixture', namkeen: 'mixture',
  papad: 'papad', achar: 'pickle', pickle: 'pickle',
  chutney: 'chutney',
};

// Blocked foods (no beef/pork)
const BLOCKED_FOODS = ['beef', 'pork', 'bacon', 'ham', 'salami', 'pepperoni'];

// Diet preference filtering helpers
const DAIRY_IDS = new Set([4, 5, 10, 19, 21, 24, 25, 111, 112, 122, 205, 206, 207]);
const EGG_IDS = new Set([103]);

function filterByDietPref(foods, dietPref) {
  if (!dietPref || dietPref === 'non_veg') return foods;
  if (dietPref === 'veg') return foods.filter(f => f.isVeg === true);
  if (dietPref === 'vegan') return foods.filter(f => f.isVeg === true && !DAIRY_IDS.has(f.id));
  if (dietPref === 'eggetarian') return foods.filter(f => f.isVeg === true || EGG_IDS.has(f.id));
  return foods;
}

// Smart fuzzy search: matches name, hindi name, aliases, and partial words
function smartSearch(foods, query) {
  const q = query.toLowerCase().trim();
  if (!q) return foods;

  // Check if query is a known alias → map to English
  const aliasMatch = HINDI_ALIASES[q];

  // Score each food for relevance
  const scored = foods.map(f => {
    const name = f.name.toLowerCase();
    const hindi = (f.hindiName || '').toLowerCase();
    const aliases = (f.aliases || []).map(a => a.toLowerCase());
    let score = 0;

    // Exact name match
    if (name === q) score += 100;
    // Alias exact match
    if (aliasMatch && name.includes(aliasMatch)) score += 80;
    // Name starts with query
    if (name.startsWith(q)) score += 60;
    // Name contains query
    if (name.includes(q)) score += 40;
    // Hindi name match
    if (hindi && hindi.includes(q)) score += 50;
    // Any alias contains query
    if (aliases.some(a => a.includes(q))) score += 45;
    // Word-level match (e.g. "tikka" matches "Chicken Tikka" and "Paneer Tikka")
    const words = name.split(/[\s()\/,]+/);
    if (words.some(w => w.startsWith(q))) score += 35;
    // Category match
    if (f.category.includes(q)) score += 10;

    return { ...f, _score: score };
  });

  return scored.filter(f => f._score > 0).sort((a, b) => b._score - a._score);
}

// External API fallback — USDA FoodData Central (free, no signup needed)
async function searchExternalAPI(query) {
  try {
    const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&dataType=Foundation,SR%20Legacy&api_key=${apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.foods || !data.foods.length) return [];

    return data.foods
      .filter(f => !BLOCKED_FOODS.some(b => f.description.toLowerCase().includes(b)))
      .map((f, idx) => {
        const getNutrient = (name) => {
          const n = f.foodNutrients?.find(n => n.nutrientName === name);
          return n ? parseFloat(n.value) || 0 : 0;
        };
        const name = f.description.split(',')[0].trim(); // Take first part before comma
        return {
          id: 9000 + idx,
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          calories: Math.round(getNutrient('Energy')),
          protein: parseFloat(getNutrient('Protein').toFixed(1)),
          carbs: parseFloat(getNutrient('Carbohydrate, by difference').toFixed(1)),
          fat: parseFloat(getNutrient('Total lipid (fat)').toFixed(1)),
          fiber: parseFloat(getNutrient('Fiber, total dietary').toFixed(1)),
          serving: '100g',
          category: 'search',
          source: 'usda',
          isVeg: !['chicken', 'fish', 'meat', 'egg', 'prawn', 'shrimp', 'lamb', 'mutton', 'turkey', 'duck', 'salmon', 'tuna', 'pork', 'beef', 'ostrich', 'goat']
            .some(m => f.description.toLowerCase().includes(m)),
        };
      });
  } catch (e) {
    return [];
  }
}

// @desc    Search food database (local + external fallback)
exports.searchFood = async (req, res, next) => {
  try {
    const { q, category, source, dietPref, page = 1, limit = 20 } = req.query;
    let results = FOOD_DATABASE;

    // Diet preference filter
    if (dietPref) results = filterByDietPref(results, dietPref);

    if (q) {
      results = smartSearch(results, q);

      // If few/no local results, try external API
      if (results.length < 3 && q.length >= 2) {
        try {
          // Resolve Hindi alias for external search
          const englishQuery = HINDI_ALIASES[q.toLowerCase().trim()] || q;
          const external = await searchExternalAPI(englishQuery);
          if (external.length > 0) {
            // Add external results that don't duplicate local ones
            const localNames = new Set(results.map(r => r.name.toLowerCase()));
            const newResults = external.filter(e => !localNames.has(e.name.toLowerCase()));
            results = [...results, ...newResults];
          }
        } catch (e) { /* external search failed, use local only */ }
      }
    }
    if (category) results = results.filter(f => f.category === category);
    if (source) results = results.filter(f => f.source === source);

    const total = results.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    results = results.slice(skip, skip + parseInt(limit));

    // Clean internal fields
    results = results.map(({ _score, ...rest }) => rest);

    res.json({ success: true, count: results.length, total, pages: Math.ceil(total / parseInt(limit)), data: results });
  } catch (error) {
    next(error);
  }
};

// @desc    Get food by ID
exports.getFoodById = async (req, res, next) => {
  try {
    const food = FOOD_DATABASE.find(f => f.id === parseInt(req.params.id));
    if (!food) return res.status(404).json({ success: false, message: 'Food not found' });
    res.json({ success: true, data: food });
  } catch (error) {
    next(error);
  }
};

// @desc    Get food categories
exports.getFoodCategories = async (req, res, next) => {
  try {
    const { dietPref } = req.query;
    let db = FOOD_DATABASE;
    if (dietPref) db = filterByDietPref(db, dietPref);
    const categories = [...new Set(db.map(f => f.category))];
    const data = categories.map(c => ({ name: c, count: db.filter(f => f.category === c).length }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate meal calories
exports.calculateMeal = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Provide items array with { foodId, quantity }' });
    }

    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;
    const breakdown = [];

    for (const item of items) {
      const food = FOOD_DATABASE.find(f => f.id === item.foodId);
      if (!food) continue;
      const multiplier = (item.quantity || 100) / 100;
      const cal = Math.round(food.calories * multiplier);
      const pro = parseFloat((food.protein * multiplier).toFixed(1));
      const carb = parseFloat((food.carbs * multiplier).toFixed(1));
      const fat = parseFloat((food.fat * multiplier).toFixed(1));
      const fib = parseFloat(((food.fiber || 0) * multiplier).toFixed(1));

      totalCalories += cal;
      totalProtein += pro;
      totalCarbs += carb;
      totalFat += fat;
      totalFiber += fib;

      breakdown.push({ name: food.name, quantity: item.quantity || 100, unit: 'g', calories: cal, protein: pro, carbs: carb, fat: fat });
    }

    res.json({
      success: true,
      data: {
        totalCalories, totalProtein: parseFloat(totalProtein.toFixed(1)),
        totalCarbs: parseFloat(totalCarbs.toFixed(1)), totalFat: parseFloat(totalFat.toFixed(1)),
        totalFiber: parseFloat(totalFiber.toFixed(1)), breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

const FOOD_DATABASE = [
  // === INDIAN FOODS ===
  { id: 1, name: 'Roti (Chapati)', hindiName: 'रोटी', aliases: ['chapati', 'chapatti', 'phulka', 'fulka'], calories: 120, protein: 3.5, carbs: 22, fat: 2.5, fiber: 2, serving: '1 medium (40g)', category: 'grains', source: 'indian', isVeg: true },
  { id: 2, name: 'Plain Rice (Cooked)', hindiName: 'चावल', aliases: ['chawal', 'chaawal', 'bhaat', 'steamed rice', 'white rice'], calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, serving: '100g cooked', category: 'grains', source: 'indian', isVeg: true },
  { id: 3, name: 'Dal (Toor/Arhar)', hindiName: 'तूर दाल', aliases: ['daal', 'dhal', 'arhar', 'toor'], calories: 120, protein: 8, carbs: 18, fat: 1.5, fiber: 5, serving: '1 bowl (150ml)', category: 'pulses', source: 'indian', isVeg: true },
  { id: 4, name: 'Paneer', hindiName: 'पनीर', aliases: ['paner', 'cottage cheese indian'], calories: 265, protein: 18, carbs: 1.2, fat: 21, fiber: 0, serving: '100g', category: 'dairy', source: 'indian', isVeg: true },
  { id: 5, name: 'Curd (Dahi)', hindiName: 'दही', aliases: ['yogurt', 'yoghurt', 'dahi'], calories: 60, protein: 3.5, carbs: 5, fat: 3.3, fiber: 0, serving: '100g', category: 'dairy', source: 'indian', isVeg: true },
  { id: 6, name: 'Rajma (Kidney Beans)', hindiName: 'राजमा', calories: 127, protein: 8.7, carbs: 22, fat: 0.5, fiber: 6.4, serving: '100g cooked', category: 'pulses', source: 'indian', isVeg: true },
  { id: 7, name: 'Chole (Chickpeas)', hindiName: 'छोले', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, serving: '100g cooked', category: 'pulses', source: 'indian', isVeg: true },
  { id: 8, name: 'Paratha (Plain)', hindiName: 'पराठा', calories: 260, protein: 5, carbs: 36, fat: 10, fiber: 2, serving: '1 medium', category: 'grains', source: 'indian', isVeg: true },
  { id: 9, name: 'Aloo Gobi', hindiName: 'आलू गोबी', calories: 118, protein: 3, carbs: 14, fat: 6, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 10, name: 'Palak Paneer', hindiName: 'पालक पनीर', calories: 200, protein: 12, carbs: 8, fat: 14, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 11, name: 'Butter Chicken', hindiName: 'बटर चिकन', calories: 240, protein: 18, carbs: 10, fat: 15, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: false },
  { id: 12, name: 'Biryani (Chicken)', hindiName: 'चिकन बिरयानी', calories: 290, protein: 15, carbs: 38, fat: 9, fiber: 1, serving: '1 plate (250g)', category: 'rice_dish', source: 'indian', isVeg: false },
  { id: 13, name: 'Idli', hindiName: 'इडली', calories: 39, protein: 2, carbs: 8, fat: 0.2, fiber: 0.5, serving: '1 piece (30g)', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 14, name: 'Dosa (Plain)', hindiName: 'डोसा', calories: 168, protein: 4, carbs: 28, fat: 4, fiber: 1, serving: '1 medium', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 15, name: 'Poha', hindiName: 'पोहा', calories: 180, protein: 4, carbs: 32, fat: 5, fiber: 2, serving: '1 plate (150g)', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 16, name: 'Upma', hindiName: 'उपमा', calories: 200, protein: 5, carbs: 30, fat: 7, fiber: 3, serving: '1 bowl (150g)', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 17, name: 'Moong Dal', hindiName: 'मूंग दाल', calories: 105, protein: 7, carbs: 18, fat: 0.4, fiber: 4, serving: '100g cooked', category: 'pulses', source: 'indian', isVeg: true },
  { id: 18, name: 'Soya Chunks', hindiName: 'सोया बड़ी', calories: 336, protein: 52, carbs: 33, fat: 0.5, fiber: 13, serving: '100g dry', category: 'protein', source: 'indian', isVeg: true },
  { id: 19, name: 'Lassi (Sweet)', hindiName: 'लस्सी', calories: 180, protein: 5, carbs: 30, fat: 5, fiber: 0, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },
  { id: 20, name: 'Samosa', hindiName: 'समोसा', calories: 260, protein: 5, carbs: 28, fat: 14, fiber: 2, serving: '1 piece (80g)', category: 'snacks', source: 'indian', isVeg: true },
  { id: 21, name: 'Ghee', hindiName: 'घी', calories: 112, protein: 0, carbs: 0, fat: 12.5, fiber: 0, serving: '1 tbsp (15ml)', category: 'fats', source: 'indian', isVeg: true },
  { id: 22, name: 'Khichdi', hindiName: 'खिचड़ी', calories: 150, protein: 6, carbs: 25, fat: 3, fiber: 3, serving: '1 bowl (200g)', category: 'rice_dish', source: 'indian', isVeg: true },
  { id: 23, name: 'Tandoori Chicken', hindiName: 'तंदूरी चिकन', calories: 165, protein: 26, carbs: 3, fat: 6, fiber: 0.5, serving: '100g', category: 'protein', source: 'indian', isVeg: false },
  { id: 24, name: 'Raita', hindiName: 'रायता', calories: 45, protein: 2, carbs: 4, fat: 2.5, fiber: 0.5, serving: '100g', category: 'sides', source: 'indian', isVeg: true },
  { id: 25, name: 'Gulab Jamun', hindiName: 'गुलाब जामुन', calories: 150, protein: 2, carbs: 22, fat: 6, fiber: 0, serving: '1 piece (40g)', category: 'dessert', source: 'indian', isVeg: true },

  // === INTERNATIONAL FOODS ===
  { id: 101, name: 'Chicken Breast (Grilled)', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, serving: '100g', category: 'protein', source: 'international', isVeg: false },
  { id: 102, name: 'Salmon (Grilled)', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, serving: '100g', category: 'protein', source: 'international', isVeg: false },
  { id: 103, name: 'Egg (Whole, Boiled)', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, serving: '100g (2 large)', category: 'protein', source: 'international', isVeg: false },
  { id: 104, name: 'Oats (Cooked)', calories: 71, protein: 2.5, carbs: 12, fat: 1.5, fiber: 2, serving: '100g cooked', category: 'grains', source: 'international', isVeg: true },
  { id: 105, name: 'Brown Rice', calories: 112, protein: 2.6, carbs: 24, fat: 0.9, fiber: 1.8, serving: '100g cooked', category: 'grains', source: 'international', isVeg: true },
  { id: 106, name: 'Avocado', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 107, name: 'Banana', hindiName: 'केला', aliases: ['kela'], calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, serving: '1 medium (118g)', category: 'fruits', source: 'international', isVeg: true },
  { id: 108, name: 'Apple', hindiName: 'सेब', aliases: ['seb'], calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 109, name: 'Almonds', calories: 579, protein: 21, carbs: 22, fat: 49, fiber: 12.5, serving: '100g', category: 'nuts', source: 'international', isVeg: true },
  { id: 110, name: 'Peanut Butter', calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, serving: '100g', category: 'nuts', source: 'international', isVeg: true },
  { id: 111, name: 'Greek Yogurt', calories: 59, protein: 10, carbs: 3.6, fat: 0.7, fiber: 0, serving: '100g', category: 'dairy', source: 'international', isVeg: true },
  { id: 112, name: 'Whey Protein (1 scoop)', calories: 120, protein: 24, carbs: 3, fat: 1.5, fiber: 0, serving: '30g scoop', category: 'supplements', source: 'international', isVeg: true },
  { id: 113, name: 'Quinoa', calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, serving: '100g cooked', category: 'grains', source: 'international', isVeg: true },
  { id: 114, name: 'Sweet Potato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 115, name: 'Broccoli', calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 116, name: 'Olive Oil', calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, serving: '1 tbsp (15ml)', category: 'fats', source: 'international', isVeg: true },
  { id: 117, name: 'Whole Wheat Bread', calories: 69, protein: 3.6, carbs: 12, fat: 1.1, fiber: 1.9, serving: '1 slice (30g)', category: 'grains', source: 'international', isVeg: true },
  { id: 118, name: 'Tofu', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, serving: '100g', category: 'protein', source: 'international', isVeg: true },
  { id: 119, name: 'Pasta (Cooked)', calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, serving: '100g', category: 'grains', source: 'international', isVeg: true },
  { id: 120, name: 'Turkey Breast', calories: 135, protein: 30, carbs: 0, fat: 1, fiber: 0, serving: '100g', category: 'protein', source: 'international', isVeg: false },
  { id: 121, name: 'Tuna (Canned)', calories: 132, protein: 29, carbs: 0, fat: 1.3, fiber: 0, serving: '100g', category: 'protein', source: 'international', isVeg: false },
  { id: 122, name: 'Cottage Cheese', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0, serving: '100g', category: 'dairy', source: 'international', isVeg: true },
  { id: 123, name: 'Dark Chocolate (70%)', calories: 598, protein: 7.8, carbs: 46, fat: 43, fiber: 11, serving: '100g', category: 'snacks', source: 'international', isVeg: true },
  { id: 124, name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 125, name: 'Spinach (Raw)', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },

  // === COMMON BEVERAGES ===
  { id: 201, name: 'Masala Chai', hindiName: 'मसाला चाय', calories: 80, protein: 2, carbs: 12, fat: 3, fiber: 0, serving: '1 cup (150ml) with milk & sugar', category: 'beverages', source: 'indian', isVeg: true },
  { id: 202, name: 'Green Tea', calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, serving: '1 cup (240ml)', category: 'beverages', source: 'international', isVeg: true },
  { id: 203, name: 'Black Coffee', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, serving: '1 cup (240ml)', category: 'beverages', source: 'international', isVeg: true },
  { id: 204, name: 'Coconut Water', hindiName: 'नारियल पानी', calories: 46, protein: 0.5, carbs: 11, fat: 0, fiber: 0, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },
  { id: 205, name: 'Buttermilk (Chaas)', hindiName: 'छाछ', calories: 40, protein: 3.3, carbs: 5, fat: 0.9, fiber: 0, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },
  { id: 206, name: 'Protein Shake (Whey + Milk)', calories: 250, protein: 35, carbs: 18, fat: 5, fiber: 0, serving: '1 glass (300ml)', category: 'beverages', source: 'international', isVeg: true },
  { id: 207, name: 'Mango Lassi', hindiName: 'मैंगो लस्सी', calories: 200, protein: 5, carbs: 35, fat: 5, fiber: 1, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },
  { id: 208, name: 'Jaljeera', hindiName: 'जलजीरा', calories: 15, protein: 0.5, carbs: 3, fat: 0, fiber: 0, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },

  // === MORE INDIAN FOODS ===
  { id: 26, name: 'Naan', hindiName: 'नान', calories: 260, protein: 8, carbs: 45, fat: 5, fiber: 2, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 27, name: 'Puri', hindiName: 'पूरी', calories: 100, protein: 2, carbs: 12, fat: 5, fiber: 0.5, serving: '1 piece (25g)', category: 'grains', source: 'indian', isVeg: true },
  { id: 28, name: 'Bhatura', hindiName: 'भटूरा', calories: 330, protein: 7, carbs: 45, fat: 14, fiber: 1, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 29, name: 'Aloo Paratha', hindiName: 'आलू पराठा', calories: 300, protein: 6, carbs: 40, fat: 13, fiber: 2, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 30, name: 'Paneer Tikka', hindiName: 'पनीर टिक्का', calories: 220, protein: 16, carbs: 6, fat: 15, fiber: 1, serving: '100g', category: 'protein', source: 'indian', isVeg: true },
  { id: 31, name: 'Chana Dal', hindiName: 'चना दाल', calories: 115, protein: 7.5, carbs: 19, fat: 1.5, fiber: 5, serving: '1 bowl (150ml)', category: 'pulses', source: 'indian', isVeg: true },
  { id: 32, name: 'Masoor Dal', hindiName: 'मसूर दाल', calories: 110, protein: 9, carbs: 17, fat: 0.5, fiber: 4, serving: '1 bowl (150ml)', category: 'pulses', source: 'indian', isVeg: true },
  { id: 33, name: 'Veg Pulao', hindiName: 'वेज पुलाव', calories: 210, protein: 4, carbs: 35, fat: 6, fiber: 2, serving: '1 plate (200g)', category: 'rice_dish', source: 'indian', isVeg: true },
  { id: 34, name: 'Jeera Rice', hindiName: 'जीरा राइस', calories: 160, protein: 3, carbs: 30, fat: 3, fiber: 0.5, serving: '1 plate (200g)', category: 'rice_dish', source: 'indian', isVeg: true },
  { id: 35, name: 'Egg Curry', hindiName: 'अंडा करी', calories: 180, protein: 14, carbs: 8, fat: 11, fiber: 1, serving: '1 bowl (2 eggs)', category: 'curry', source: 'indian', isVeg: false },
  { id: 36, name: 'Fish Curry', hindiName: 'मछली करी', calories: 200, protein: 22, carbs: 8, fat: 9, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: false },
  { id: 37, name: 'Mutton Curry', hindiName: 'मटन करी', calories: 280, protein: 20, carbs: 8, fat: 19, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: false },
  { id: 38, name: 'Chicken Tikka', hindiName: 'चिकन टिक्का', calories: 180, protein: 28, carbs: 4, fat: 6, fiber: 0.5, serving: '100g', category: 'protein', source: 'indian', isVeg: false },
  { id: 39, name: 'Matar Paneer', hindiName: 'मटर पनीर', calories: 210, protein: 13, carbs: 12, fat: 13, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 40, name: 'Bhindi (Okra) Fry', hindiName: 'भिंडी फ्राई', calories: 90, protein: 2.5, carbs: 8, fat: 6, fiber: 3, serving: '1 bowl (100g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 41, name: 'Baingan Bharta', hindiName: 'बैंगन भर्ता', calories: 110, protein: 3, carbs: 10, fat: 7, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 42, name: 'Aloo Matar', hindiName: 'आलू मटर', calories: 130, protein: 4, carbs: 18, fat: 5, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 43, name: 'Mixed Veg', hindiName: 'मिक्स वेज', calories: 100, protein: 3, carbs: 12, fat: 5, fiber: 4, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 44, name: 'Kadhi Pakora', hindiName: 'कढ़ी पकोड़ा', calories: 150, protein: 5, carbs: 15, fat: 8, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 45, name: 'Uttapam', hindiName: 'उत्तपम', calories: 200, protein: 5, carbs: 32, fat: 5, fiber: 2, serving: '1 piece', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 46, name: 'Masala Dosa', hindiName: 'मसाला डोसा', calories: 250, protein: 5, carbs: 35, fat: 10, fiber: 2, serving: '1 piece', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 47, name: 'Vada', hindiName: 'वड़ा', calories: 170, protein: 6, carbs: 18, fat: 9, fiber: 2, serving: '2 pieces', category: 'breakfast', source: 'indian', isVeg: true },
  { id: 48, name: 'Pav Bhaji', hindiName: 'पाव भाजी', calories: 350, protein: 8, carbs: 45, fat: 15, fiber: 4, serving: '1 plate', category: 'snacks', source: 'indian', isVeg: true },
  { id: 49, name: 'Chaat (Papdi)', hindiName: 'पापड़ी चाट', calories: 250, protein: 5, carbs: 30, fat: 12, fiber: 2, serving: '1 plate', category: 'snacks', source: 'indian', isVeg: true },
  { id: 50, name: 'Dhokla', hindiName: 'ढोकला', calories: 130, protein: 5, carbs: 20, fat: 3, fiber: 1, serving: '3 pieces (100g)', category: 'snacks', source: 'indian', isVeg: true },
  { id: 51, name: 'Jalebi', hindiName: 'जलेबी', calories: 150, protein: 1, carbs: 30, fat: 5, fiber: 0, serving: '2 pieces (50g)', category: 'dessert', source: 'indian', isVeg: true },
  { id: 52, name: 'Kheer', hindiName: 'खीर', calories: 180, protein: 5, carbs: 28, fat: 6, fiber: 0, serving: '1 bowl (150ml)', category: 'dessert', source: 'indian', isVeg: true },
  { id: 53, name: 'Halwa (Sooji)', hindiName: 'सूजी हलवा', calories: 250, protein: 4, carbs: 35, fat: 12, fiber: 1, serving: '1 bowl (100g)', category: 'dessert', source: 'indian', isVeg: true },

  // === MORE INTERNATIONAL FOODS ===
  { id: 126, name: 'Pizza (1 slice)', calories: 285, protein: 12, carbs: 36, fat: 11, fiber: 2, serving: '1 slice (107g)', category: 'snacks', source: 'international', isVeg: false },
  { id: 127, name: 'Burger (Chicken)', calories: 350, protein: 20, carbs: 35, fat: 15, fiber: 2, serving: '1 piece', category: 'snacks', source: 'international', isVeg: false },
  { id: 128, name: 'French Fries', calories: 312, protein: 3.4, carbs: 41, fat: 15, fiber: 3.8, serving: '100g', category: 'snacks', source: 'international', isVeg: true },
  { id: 129, name: 'Sandwich (Veg)', calories: 250, protein: 8, carbs: 30, fat: 10, fiber: 3, serving: '1 piece', category: 'snacks', source: 'international', isVeg: true },
  { id: 130, name: 'Milk (Full Cream)', calories: 60, protein: 3.2, carbs: 4.7, fat: 3.3, fiber: 0, serving: '100ml', category: 'dairy', source: 'international', isVeg: true },
  { id: 131, name: 'Milk (Toned)', calories: 42, protein: 3, carbs: 4.5, fat: 1.5, fiber: 0, serving: '100ml', category: 'dairy', source: 'international', isVeg: true },
  { id: 132, name: 'Mango', hindiName: 'आम', aliases: ['aam', 'keri'], calories: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 133, name: 'Watermelon', hindiName: 'तरबूज', calories: 30, protein: 0.6, carbs: 7.5, fat: 0.2, fiber: 0.4, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 134, name: 'Papaya', hindiName: 'पपीता', calories: 43, protein: 0.5, carbs: 11, fat: 0.3, fiber: 1.7, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 135, name: 'Orange', hindiName: 'संतरा', calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 136, name: 'Grapes', hindiName: 'अंगूर', calories: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 137, name: 'Pomegranate', hindiName: 'अनार', calories: 83, protein: 1.7, carbs: 19, fat: 1.2, fiber: 4, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 138, name: 'Peanuts (Roasted)', hindiName: 'मूंगफली', calories: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, serving: '100g', category: 'nuts', source: 'indian', isVeg: true },
  { id: 139, name: 'Cashews', hindiName: 'काजू', calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, serving: '100g', category: 'nuts', source: 'indian', isVeg: true },
  { id: 140, name: 'Walnuts', hindiName: 'अखरोट', calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, serving: '100g', category: 'nuts', source: 'international', isVeg: true },
  { id: 141, name: 'Maggi Noodles', hindiName: 'मैगी', calories: 420, protein: 9, carbs: 58, fat: 17, fiber: 2, serving: '1 pack (70g dry)', category: 'snacks', source: 'indian', isVeg: true },
  { id: 142, name: 'Thepla', hindiName: 'थेपला', calories: 150, protein: 4, carbs: 22, fat: 5, fiber: 2, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 143, name: 'Methi Thepla', hindiName: 'मेथी थेपला', calories: 140, protein: 4.5, carbs: 20, fat: 5, fiber: 2.5, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 144, name: 'Sprouts (Moong)', hindiName: 'अंकुरित मूंग', calories: 30, protein: 3, carbs: 4, fat: 0.2, fiber: 2, serving: '100g', category: 'pulses', source: 'indian', isVeg: true },
  { id: 145, name: 'Corn (Boiled)', hindiName: 'भुट्टा', calories: 96, protein: 3.4, carbs: 21, fat: 1.5, fiber: 2.4, serving: '1 ear (100g)', category: 'vegetables', source: 'international', isVeg: true },
  { id: 146, name: 'Cucumber', hindiName: 'खीरा', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 147, name: 'Tomato', hindiName: 'टमाटर', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 148, name: 'Onion', hindiName: 'प्याज', calories: 40, protein: 1.1, carbs: 9, fat: 0.1, fiber: 1.7, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 149, name: 'Potato (Boiled)', hindiName: 'आलू', calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 150, name: 'Carrot', hindiName: 'गाजर', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },

  // === MORE FRUITS ===
  { id: 151, name: 'Guava', hindiName: 'अमरूद', aliases: ['amrood', 'amrud'], calories: 68, protein: 2.6, carbs: 14, fat: 1, fiber: 5.4, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 152, name: 'Lychee', hindiName: 'लीची', aliases: ['litchi', 'lichi'], calories: 66, protein: 0.8, carbs: 17, fat: 0.4, fiber: 1.3, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 153, name: 'Pineapple', hindiName: 'अनानास', aliases: ['ananas'], calories: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 154, name: 'Pear', hindiName: 'नाशपाती', aliases: ['nashpati'], calories: 57, protein: 0.4, carbs: 15, fat: 0.1, fiber: 3.1, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 155, name: 'Sapota (Chikoo)', hindiName: 'चीकू', aliases: ['chikoo', 'chiku', 'sapodilla'], calories: 83, protein: 0.4, carbs: 20, fat: 1.1, fiber: 5.3, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 156, name: 'Jamun', hindiName: 'जामुन', aliases: ['java plum', 'black plum'], calories: 62, protein: 0.7, carbs: 16, fat: 0.2, fiber: 0.6, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 157, name: 'Strawberry', calories: 33, protein: 0.7, carbs: 8, fat: 0.3, fiber: 2, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 158, name: 'Kiwi', calories: 61, protein: 1.1, carbs: 15, fat: 0.5, fiber: 3, serving: '100g', category: 'fruits', source: 'international', isVeg: true },
  { id: 159, name: 'Dates (Khajoor)', hindiName: 'खजूर', aliases: ['khajur', 'khajoor'], calories: 277, protein: 1.8, carbs: 75, fat: 0.2, fiber: 7, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 160, name: 'Coconut (Fresh)', hindiName: 'नारियल', aliases: ['nariyal'], calories: 354, protein: 3.3, carbs: 15, fat: 33, fiber: 9, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },

  // === MORE DISHES & SNACKS ===
  { id: 161, name: 'Momos (Veg)', aliases: ['momo', 'dumpling'], calories: 200, protein: 6, carbs: 28, fat: 7, fiber: 2, serving: '6 pieces', category: 'snacks', source: 'indian', isVeg: true },
  { id: 162, name: 'Momos (Chicken)', aliases: ['chicken momo'], calories: 250, protein: 14, carbs: 25, fat: 10, fiber: 1, serving: '6 pieces', category: 'snacks', source: 'indian', isVeg: false },
  { id: 163, name: 'Spring Roll', aliases: ['roll'], calories: 150, protein: 4, carbs: 20, fat: 7, fiber: 1, serving: '2 pieces', category: 'snacks', source: 'international', isVeg: true },
  { id: 164, name: 'Pakora (Onion)', hindiName: 'प्याज पकोड़ा', aliases: ['bhajiya', 'pakoda'], calories: 180, protein: 4, carbs: 20, fat: 10, fiber: 2, serving: '5 pieces (80g)', category: 'snacks', source: 'indian', isVeg: true },
  { id: 165, name: 'Vada Pav', hindiName: 'वड़ा पाव', calories: 290, protein: 6, carbs: 38, fat: 13, fiber: 2, serving: '1 piece', category: 'snacks', source: 'indian', isVeg: true },
  { id: 166, name: 'Kachori', hindiName: 'कचौरी', calories: 270, protein: 6, carbs: 30, fat: 14, fiber: 2, serving: '1 piece (60g)', category: 'snacks', source: 'indian', isVeg: true },
  { id: 167, name: 'Chole Bhature', hindiName: 'छोले भटूरे', calories: 500, protein: 15, carbs: 60, fat: 22, fiber: 5, serving: '1 plate', category: 'snacks', source: 'indian', isVeg: true },
  { id: 168, name: 'Keema (Chicken)', hindiName: 'कीमा', aliases: ['qeema', 'mince'], calories: 200, protein: 18, carbs: 5, fat: 12, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: false },
  { id: 169, name: 'Prawn Curry', hindiName: 'झींगा करी', aliases: ['jhinga', 'shrimp'], calories: 180, protein: 20, carbs: 6, fat: 9, fiber: 1, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: false },
  { id: 170, name: 'Kadai Paneer', hindiName: 'कड़ाही पनीर', calories: 230, protein: 14, carbs: 8, fat: 16, fiber: 2, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 171, name: 'Dal Makhani', hindiName: 'दाल मखनी', calories: 180, protein: 9, carbs: 20, fat: 8, fiber: 5, serving: '1 bowl (150g)', category: 'pulses', source: 'indian', isVeg: true },
  { id: 172, name: 'Biryani (Veg)', hindiName: 'वेज बिरयानी', calories: 220, protein: 5, carbs: 38, fat: 6, fiber: 2, serving: '1 plate (250g)', category: 'rice_dish', source: 'indian', isVeg: true },
  { id: 173, name: 'Egg Bhurji', hindiName: 'अंडा भुर्जी', aliases: ['scrambled egg'], calories: 180, protein: 12, carbs: 3, fat: 14, fiber: 0.5, serving: '2 eggs', category: 'breakfast', source: 'indian', isVeg: false },
  { id: 174, name: 'Omelette', aliases: ['omlet', 'omelet'], calories: 154, protein: 11, carbs: 1, fat: 12, fiber: 0, serving: '2 eggs', category: 'breakfast', source: 'international', isVeg: false },
  { id: 175, name: 'Boiled Egg', aliases: ['anda', 'hard boiled'], calories: 78, protein: 6, carbs: 0.6, fat: 5, fiber: 0, serving: '1 egg', category: 'protein', source: 'international', isVeg: false },

  // === SWEETS / DESSERTS ===
  { id: 176, name: 'Ladoo (Besan)', hindiName: 'बेसन लड्डू', aliases: ['laddu', 'laddoo'], calories: 180, protein: 4, carbs: 22, fat: 9, fiber: 1, serving: '1 piece (40g)', category: 'dessert', source: 'indian', isVeg: true },
  { id: 177, name: 'Barfi (Kaju)', hindiName: 'काजू बर्फी', aliases: ['burfi', 'katli'], calories: 160, protein: 3, carbs: 22, fat: 7, fiber: 0.5, serving: '1 piece (30g)', category: 'dessert', source: 'indian', isVeg: true },
  { id: 178, name: 'Rasgulla', hindiName: 'रसगुल्ला', aliases: ['rasagulla'], calories: 130, protein: 3, carbs: 26, fat: 1.5, fiber: 0, serving: '2 pieces', category: 'dessert', source: 'indian', isVeg: true },
  { id: 179, name: 'Ice Cream', calories: 207, protein: 3.5, carbs: 24, fat: 11, fiber: 0, serving: '100g (1 scoop)', category: 'dessert', source: 'international', isVeg: true },
  { id: 180, name: 'Gajar Ka Halwa', hindiName: 'गाजर हलवा', aliases: ['carrot halwa'], calories: 200, protein: 4, carbs: 28, fat: 9, fiber: 1.5, serving: '1 bowl (100g)', category: 'dessert', source: 'indian', isVeg: true },

  // === MORE VEGS ===
  { id: 181, name: 'Cauliflower', hindiName: 'फूल गोभी', aliases: ['gobi', 'gobhi', 'phool gobi'], calories: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 182, name: 'Capsicum (Bell Pepper)', hindiName: 'शिमला मिर्च', aliases: ['shimla mirch'], calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 183, name: 'Mushroom', calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 184, name: 'Bottle Gourd (Lauki)', hindiName: 'लौकी', aliases: ['lauki', 'ghiya', 'dudhi'], calories: 14, protein: 0.6, carbs: 3.4, fat: 0, fiber: 0.5, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 185, name: 'Bitter Gourd (Karela)', hindiName: 'करेला', aliases: ['karela'], calories: 17, protein: 1, carbs: 3.7, fat: 0.2, fiber: 2.8, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 186, name: 'Peas (Green)', hindiName: 'मटर', aliases: ['matar', 'mutter'], calories: 81, protein: 5.4, carbs: 14, fat: 0.4, fiber: 5.1, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },
  { id: 187, name: 'Cabbage', hindiName: 'पत्ता गोभी', aliases: ['patta gobi', 'band gobi'], calories: 25, protein: 1.3, carbs: 6, fat: 0.1, fiber: 2.5, serving: '100g', category: 'vegetables', source: 'international', isVeg: true },

  // === MISC COMMON ===
  { id: 188, name: 'Lemon Water (Nimbu Pani)', hindiName: 'नींबू पानी', aliases: ['nimbu pani', 'shikanji', 'lemonade'], calories: 25, protein: 0, carbs: 6, fat: 0, fiber: 0, serving: '1 glass (250ml)', category: 'beverages', source: 'indian', isVeg: true },
  { id: 189, name: 'Pistachio', hindiName: 'पिस्ता', aliases: ['pista'], calories: 562, protein: 20, carbs: 28, fat: 45, fiber: 10, serving: '100g', category: 'nuts', source: 'international', isVeg: true },
  { id: 190, name: 'Raisin (Kishmish)', hindiName: 'किशमिश', aliases: ['kishmish', 'munakka'], calories: 299, protein: 3.1, carbs: 79, fat: 0.5, fiber: 3.7, serving: '100g', category: 'fruits', source: 'indian', isVeg: true },
  { id: 191, name: 'Honey (Shahad)', hindiName: 'शहद', aliases: ['shahad', 'madhu'], calories: 64, protein: 0.1, carbs: 17, fat: 0, fiber: 0, serving: '1 tbsp (21g)', category: 'fats', source: 'international', isVeg: true },
  { id: 192, name: 'Urad Dal', hindiName: 'उड़द दाल', aliases: ['urad', 'black gram'], calories: 115, protein: 8, carbs: 19, fat: 0.6, fiber: 4.5, serving: '1 bowl (150ml)', category: 'pulses', source: 'indian', isVeg: true },
  { id: 193, name: 'Dalia (Broken Wheat)', hindiName: 'दलिया', aliases: ['daliya', 'bulgar'], calories: 140, protein: 5, carbs: 28, fat: 1, fiber: 4, serving: '1 bowl (150g)', category: 'grains', source: 'indian', isVeg: true },

  // === MISSING INDIAN VEGETABLES ===
  { id: 194, name: 'Jackfruit (Kathal)', hindiName: 'कटहल', aliases: ['kathal', 'katahal', 'kathar'], calories: 95, protein: 1.7, carbs: 23, fat: 0.6, fiber: 1.5, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 195, name: 'Taro (Arbi)', hindiName: 'अरबी', aliases: ['arbi', 'arvi', 'colocasia'], calories: 112, protein: 1.5, carbs: 26, fat: 0.2, fiber: 4.1, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 196, name: 'Yam (Suran)', hindiName: 'सूरन', aliases: ['suran', 'jimikand', 'elephant foot'], calories: 118, protein: 1.5, carbs: 28, fat: 0.2, fiber: 4, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 197, name: 'Sarson Ka Saag', hindiName: 'सरसों का साग', aliases: ['saag', 'sarson', 'mustard greens'], calories: 90, protein: 4, carbs: 8, fat: 5, fiber: 3, serving: '1 bowl (150g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 198, name: 'Methi Sabzi', hindiName: 'मेथी', aliases: ['methi', 'fenugreek'], calories: 50, protein: 3, carbs: 6, fat: 1, fiber: 3, serving: '1 bowl (100g)', category: 'curry', source: 'indian', isVeg: true },
  { id: 199, name: 'Pumpkin (Kaddu)', hindiName: 'कद्दू', aliases: ['kaddu', 'sitafal', 'petha'], calories: 26, protein: 1, carbs: 6.5, fat: 0.1, fiber: 0.5, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 200, name: 'Drumstick (Sahjan)', hindiName: 'सहजन', aliases: ['sahjan', 'moringa', 'shevga'], calories: 37, protein: 2.1, carbs: 8.5, fat: 0.2, fiber: 2, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },
  { id: 201, name: 'Raw Banana Sabzi', hindiName: 'कच्चा केला', aliases: ['kachcha kela', 'raw banana', 'plantain'], calories: 122, protein: 1.3, carbs: 32, fat: 0.4, fiber: 2.3, serving: '100g', category: 'vegetables', source: 'indian', isVeg: true },

  // === MISSING COMMON ITEMS ===
  { id: 202, name: 'Makhana (Fox Nuts)', hindiName: 'मखाना', aliases: ['makhana', 'fox nut', 'lotus seeds'], calories: 347, protein: 9.7, carbs: 77, fat: 0.1, fiber: 7.6, serving: '100g dry', category: 'snacks', source: 'indian', isVeg: true },
  { id: 203, name: 'Popcorn (Plain)', aliases: ['popcorn'], calories: 375, protein: 11, carbs: 74, fat: 4.3, fiber: 15, serving: '100g', category: 'snacks', source: 'international', isVeg: true },
  { id: 204, name: 'Puffed Rice (Murmura)', hindiName: 'मुरमुरा', aliases: ['murmura', 'puffed rice', 'kurmura', 'mamra'], calories: 400, protein: 6, carbs: 90, fat: 0.5, fiber: 1, serving: '100g', category: 'snacks', source: 'indian', isVeg: true },
  { id: 209, name: 'Semolina (Suji/Rava)', hindiName: 'सूजी', aliases: ['suji', 'sooji', 'rava', 'semolina'], calories: 360, protein: 13, carbs: 73, fat: 1.1, fiber: 3.9, serving: '100g dry', category: 'grains', source: 'indian', isVeg: true },
  { id: 210, name: 'Gram Flour (Besan)', hindiName: 'बेसन', aliases: ['besan', 'gram flour', 'chickpea flour'], calories: 387, protein: 22, carbs: 58, fat: 7, fiber: 10, serving: '100g', category: 'grains', source: 'indian', isVeg: true },
  { id: 211, name: 'Papad', hindiName: 'पापड़', aliases: ['papad', 'papadum'], calories: 55, protein: 3, carbs: 8, fat: 1.5, fiber: 1, serving: '1 piece (15g)', category: 'sides', source: 'indian', isVeg: true },
  { id: 212, name: 'Pickle (Achar)', hindiName: 'अचार', aliases: ['achar', 'pickle'], calories: 40, protein: 0.5, carbs: 4, fat: 3, fiber: 1, serving: '1 tbsp (15g)', category: 'sides', source: 'indian', isVeg: true },
  { id: 213, name: 'Green Chutney', hindiName: 'हरी चटनी', aliases: ['chutney', 'mint chutney', 'pudina chutney'], calories: 20, protein: 1, carbs: 3, fat: 0.5, fiber: 1, serving: '1 tbsp (15g)', category: 'sides', source: 'indian', isVeg: true },
  { id: 214, name: 'Makki Ki Roti', hindiName: 'मक्की की रोटी', aliases: ['makki roti', 'corn roti', 'makai roti'], calories: 110, protein: 2.5, carbs: 22, fat: 1.5, fiber: 2, serving: '1 piece', category: 'grains', source: 'indian', isVeg: true },
  { id: 215, name: 'Falooda', hindiName: 'फालूदा', aliases: ['falooda', 'faluda'], calories: 250, protein: 4, carbs: 45, fat: 6, fiber: 0.5, serving: '1 glass (250ml)', category: 'dessert', source: 'indian', isVeg: true },
  { id: 216, name: 'Kulfi', hindiName: 'कुल्फी', aliases: ['kulfi'], calories: 160, protein: 4, carbs: 20, fat: 7, fiber: 0, serving: '1 piece (80g)', category: 'dessert', source: 'indian', isVeg: true },
];
