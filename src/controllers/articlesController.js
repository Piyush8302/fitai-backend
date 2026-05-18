const Article = require('../models/Article');

// @desc    Get all articles (with filters)
exports.getArticles = async (req, res, next) => {
  try {
    const { category, source, tag, search, page = 1, limit = 20 } = req.query;
    const filter = { isPublished: true };

    if (category) filter.category = category;
    if (source) filter.source = source;
    if (tag) filter.tags = { $in: [tag] };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [articles, total] = await Promise.all([
      Article.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-content'),
      Article.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: articles.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: articles,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single article by slug
exports.getArticle = async (req, res, next) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, isPublished: true });
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    article.views += 1;
    await article.save();

    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

// @desc    Get articles by category
exports.getByCategory = async (req, res, next) => {
  try {
    const articles = await Article.find({ category: req.params.category, isPublished: true })
      .sort({ createdAt: -1 }).limit(20).select('-content');
    res.json({ success: true, count: articles.length, data: articles });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all categories with counts
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Article.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// @desc    Like an article
exports.likeArticle = async (req, res, next) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, likes: article.likes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trending articles
exports.getTrending = async (req, res, next) => {
  try {
    const articles = await Article.find({ isPublished: true })
      .sort({ views: -1, likes: -1 }).limit(10).select('-content');
    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed articles (admin)
exports.seedArticles = async (req, res, next) => {
  try {
    const count = await Article.countDocuments();
    if (count > 0) return res.json({ success: true, message: `Already ${count} articles exist` });

    const articles = getSeedArticles();
    await Article.insertMany(articles);
    res.json({ success: true, message: `${articles.length} articles seeded`, count: articles.length });
  } catch (error) {
    next(error);
  }
};

function getSeedArticles() {
  return [
    {
      title: 'Complete Indian Diet Plan for Weight Loss',
      summary: 'A traditional Indian diet plan that helps you lose weight while enjoying dal, roti, sabzi and more.',
      content: `<h2>Indian Weight Loss Diet Plan</h2>
<p><strong>Early Morning (6:30 AM):</strong> Warm water with lemon and honey OR methi (fenugreek) water</p>
<p><strong>Breakfast (8:00 AM):</strong> 2 moong dal chilla with mint chutney + 1 cup green tea OR 1 bowl poha with peanuts and vegetables</p>
<p><strong>Mid-Morning (10:30 AM):</strong> 1 fruit (apple/papaya/guava) + 5 almonds</p>
<p><strong>Lunch (1:00 PM):</strong> 2 multigrain roti + 1 bowl dal + 1 bowl sabzi + salad + 1 small bowl curd</p>
<p><strong>Evening Snack (4:00 PM):</strong> 1 cup green tea + roasted chana or makhana</p>
<p><strong>Dinner (7:30 PM):</strong> 1 bowl vegetable khichdi OR 2 roti + palak paneer + salad</p>
<h3>Key Tips</h3>
<ul>
<li>Use mustard oil or ghee instead of refined oil</li>
<li>Add haldi, jeera, ajwain to meals for metabolism boost</li>
<li>Drink 8-10 glasses of water daily</li>
<li>Avoid maida, sugar, and packaged foods</li>
<li>Include buttermilk (chaas) for better digestion</li>
</ul>
<h3>Weekly Calorie Target</h3>
<p>This plan provides approximately 1400-1600 calories per day, suitable for moderate weight loss of 0.5-1 kg per week.</p>`,
      category: 'indian_diet',
      tags: ['weight loss', 'indian diet', 'dal', 'roti', 'healthy eating'],
      source: 'indian',
      readTime: 8,
    },
    {
      title: 'High Protein Indian Vegetarian Diet for Muscle Building',
      summary: 'Build muscle on a pure vegetarian Indian diet with paneer, dal, soya, and traditional protein-rich foods.',
      content: `<h2>Vegetarian Muscle Building Diet</h2>
<p><strong>Protein Target:</strong> 1.6-2.2g per kg body weight</p>
<h3>Daily Meal Plan (For 70kg person - 130g protein)</h3>
<p><strong>Breakfast:</strong> 3 egg-white bhurji (or besan chilla) + 2 whole wheat toast + 1 glass milk with whey protein</p>
<p><strong>Snack 1:</strong> 200g paneer tikka + 1 banana</p>
<p><strong>Lunch:</strong> 2 roti + 1 big bowl rajma/chole + 1 bowl brown rice + curd + salad</p>
<p><strong>Pre-Workout:</strong> 1 banana + 10 almonds + black coffee</p>
<p><strong>Post-Workout:</strong> Whey protein shake with milk + 1 banana</p>
<p><strong>Dinner:</strong> Soya chunk curry + 3 roti + dal + salad</p>
<p><strong>Before Bed:</strong> 1 glass milk with turmeric (haldi doodh)</p>
<h3>Top Indian Veg Protein Sources</h3>
<ul>
<li>Paneer (cottage cheese): 18g protein per 100g</li>
<li>Soya chunks: 52g protein per 100g</li>
<li>Rajma (kidney beans): 24g per 100g (raw)</li>
<li>Chana (chickpeas): 19g per 100g (raw)</li>
<li>Moong dal: 24g per 100g (raw)</li>
<li>Peanuts: 26g per 100g</li>
<li>Greek yogurt/Hung curd: 10g per 100g</li>
</ul>`,
      category: 'nutrition',
      tags: ['muscle building', 'vegetarian', 'protein', 'indian food', 'paneer'],
      source: 'indian',
      readTime: 7,
    },
    {
      title: 'Mediterranean Diet: Complete Guide',
      summary: 'The world-famous Mediterranean diet for heart health, weight management, and longevity.',
      content: `<h2>What is the Mediterranean Diet?</h2>
<p>The Mediterranean diet is inspired by traditional eating patterns of countries bordering the Mediterranean Sea. It emphasizes whole foods, healthy fats, and lean proteins.</p>
<h3>Daily Meal Plan</h3>
<p><strong>Breakfast:</strong> Greek yogurt with berries, walnuts, and a drizzle of honey + whole grain toast with avocado</p>
<p><strong>Lunch:</strong> Grilled chicken salad with olive oil dressing, feta cheese, tomatoes, cucumbers, and olives + whole wheat pita</p>
<p><strong>Snack:</strong> Hummus with carrot sticks and whole grain crackers</p>
<p><strong>Dinner:</strong> Grilled salmon with roasted vegetables (zucchini, bell peppers, eggplant) + quinoa + glass of red wine (optional)</p>
<h3>Core Principles</h3>
<ul>
<li>Extra virgin olive oil as primary fat source</li>
<li>Fish and seafood twice a week minimum</li>
<li>Abundant fruits, vegetables, whole grains, legumes</li>
<li>Moderate dairy (mainly yogurt and cheese)</li>
<li>Limit red meat to few times per month</li>
<li>Herbs and spices instead of salt</li>
</ul>
<h3>Health Benefits</h3>
<ul>
<li>30% reduced risk of heart disease</li>
<li>Improved brain health and memory</li>
<li>Better blood sugar control</li>
<li>Anti-inflammatory properties</li>
</ul>`,
      category: 'international_diet',
      tags: ['mediterranean', 'heart health', 'international diet', 'healthy fats'],
      source: 'international',
      readTime: 8,
    },
    {
      title: 'Keto Diet Plan: Indian and International Options',
      summary: 'Complete ketogenic diet guide with both Indian and Western meal options for rapid fat loss.',
      content: `<h2>Ketogenic Diet Guide</h2>
<p>The keto diet is a high-fat, low-carb diet that puts your body in a state of ketosis, burning fat for fuel instead of carbs.</p>
<h3>Macro Split</h3>
<ul><li>Fat: 70-75%</li><li>Protein: 20-25%</li><li>Carbs: 5-10% (under 50g/day)</li></ul>
<h3>Indian Keto Meal Plan</h3>
<p><strong>Breakfast:</strong> Paneer bhurji cooked in ghee + bulletproof coffee (coffee + ghee + MCT oil)</p>
<p><strong>Lunch:</strong> Palak paneer (extra cream) + cauliflower rice + side of avocado</p>
<p><strong>Snack:</strong> Cheese cubes + almonds + coconut chunks</p>
<p><strong>Dinner:</strong> Tandoori chicken + butter garlic mushrooms + cucumber raita</p>
<h3>International Keto Meal Plan</h3>
<p><strong>Breakfast:</strong> Bacon and eggs + avocado + butter coffee</p>
<p><strong>Lunch:</strong> Grilled salmon + Caesar salad (no croutons) + olive oil dressing</p>
<p><strong>Snack:</strong> Pork rinds + guacamole</p>
<p><strong>Dinner:</strong> Ribeye steak + grilled asparagus with butter + side salad</p>
<h3>Foods to Avoid</h3>
<ul><li>Rice, roti, bread, pasta</li><li>Sugar, jaggery, honey</li><li>Fruits (except berries in moderation)</li><li>Potatoes, sweet potatoes</li><li>Dal and legumes (moderate)</li></ul>`,
      category: 'nutrition',
      tags: ['keto', 'low carb', 'fat loss', 'indian keto', 'ketogenic'],
      source: 'fitai',
      readTime: 9,
    },
    {
      title: 'Yoga for Beginners: 15 Essential Asanas',
      summary: 'Start your yoga journey with these 15 fundamental poses that improve flexibility, strength, and mental clarity.',
      content: `<h2>Beginner Yoga Routine</h2>
<p>Practice these asanas daily for 30-45 minutes for best results.</p>
<h3>Warm-Up (5 min)</h3>
<ol>
<li><strong>Tadasana (Mountain Pose):</strong> Stand tall, feet together, arms at sides. Ground through feet, lengthen spine. Hold 30 seconds.</li>
<li><strong>Surya Namaskar (Sun Salutation):</strong> 3-5 rounds to warm up entire body.</li>
</ol>
<h3>Standing Poses</h3>
<ol start="3">
<li><strong>Virabhadrasana I (Warrior I):</strong> Strengthens legs, opens hips and chest. Hold 30s each side.</li>
<li><strong>Virabhadrasana II (Warrior II):</strong> Builds stamina and leg strength. Hold 30s each side.</li>
<li><strong>Trikonasana (Triangle Pose):</strong> Stretches hamstrings, opens chest. Hold 30s each side.</li>
<li><strong>Vrikshasana (Tree Pose):</strong> Improves balance and focus. Hold 30s each side.</li>
</ol>
<h3>Seated Poses</h3>
<ol start="7">
<li><strong>Paschimottanasana (Seated Forward Bend):</strong> Stretches hamstrings and spine.</li>
<li><strong>Baddha Konasana (Butterfly Pose):</strong> Opens hips, great for flexibility.</li>
<li><strong>Ardha Matsyendrasana (Seated Twist):</strong> Improves spinal mobility and digestion.</li>
</ol>
<h3>Floor Poses</h3>
<ol start="10">
<li><strong>Bhujangasana (Cobra Pose):</strong> Strengthens back, opens chest.</li>
<li><strong>Setu Bandhasana (Bridge Pose):</strong> Strengthens glutes and back.</li>
<li><strong>Balasana (Child's Pose):</strong> Rest and recovery pose.</li>
</ol>
<h3>Cool Down</h3>
<ol start="13">
<li><strong>Viparita Karani (Legs Up Wall):</strong> Reduces leg fatigue, calms mind.</li>
<li><strong>Supta Baddha Konasana (Reclining Butterfly):</strong> Deep hip opener.</li>
<li><strong>Shavasana (Corpse Pose):</strong> Final relaxation, 5-10 minutes.</li>
</ol>`,
      category: 'yoga',
      tags: ['yoga', 'beginners', 'asanas', 'flexibility', 'meditation'],
      source: 'indian',
      readTime: 10,
    },
    {
      title: 'Intermittent Fasting: Complete Guide for Indians',
      summary: 'How to do intermittent fasting with Indian meals - 16:8, 5:2, and warrior diet methods explained.',
      content: `<h2>Intermittent Fasting (IF) Guide</h2>
<h3>Popular IF Methods</h3>
<ul>
<li><strong>16:8 Method:</strong> Fast 16 hours, eat in 8-hour window (most popular)</li>
<li><strong>5:2 Method:</strong> Eat normally 5 days, restrict to 500-600 cal on 2 days</li>
<li><strong>20:4 Warrior Diet:</strong> Fast 20 hours, eat one large meal</li>
</ul>
<h3>16:8 Indian Meal Plan</h3>
<p><strong>Eating Window: 12:00 PM - 8:00 PM</strong></p>
<p><strong>12:00 PM (Break fast):</strong> 2 roti + dal + sabzi + salad + curd</p>
<p><strong>3:00 PM (Snack):</strong> Handful of mixed nuts + green tea</p>
<p><strong>5:00 PM (Pre-workout):</strong> 1 banana + black coffee</p>
<p><strong>7:30 PM (Dinner):</strong> Grilled paneer/chicken + brown rice + soup</p>
<p><strong>Fasting Window: 8:00 PM - 12:00 PM next day</strong></p>
<p>Allowed during fast: Water, black coffee, green tea, plain water with lemon</p>
<h3>Benefits</h3>
<ul>
<li>Improved insulin sensitivity</li>
<li>Enhanced fat burning (increases HGH by 500%)</li>
<li>Better mental clarity and focus</li>
<li>Cellular repair through autophagy</li>
<li>Reduced inflammation</li>
</ul>
<h3>Who Should Avoid IF</h3>
<ul>
<li>Pregnant or breastfeeding women</li>
<li>People with diabetes (consult doctor first)</li>
<li>Those with eating disorder history</li>
<li>Underweight individuals (BMI < 18.5)</li>
</ul>`,
      category: 'weight_loss',
      tags: ['intermittent fasting', 'weight loss', '16:8', 'fasting', 'indian'],
      source: 'fitai',
      readTime: 7,
    },
    {
      title: 'Ayurvedic Home Remedies for Common Health Issues',
      summary: 'Traditional Ayurvedic remedies using kitchen ingredients for digestion, immunity, skin, and more.',
      content: `<h2>Ayurvedic Home Remedies</h2>
<h3>For Digestion</h3>
<ul>
<li><strong>Ajwain Water:</strong> Boil 1 tsp ajwain in water, strain and drink. Relieves bloating and gas.</li>
<li><strong>Jeera Water:</strong> Soak 1 tsp cumin in water overnight. Drink morning empty stomach for metabolism.</li>
<li><strong>Triphala:</strong> 1 tsp triphala powder in warm water before bed. Best natural detox.</li>
</ul>
<h3>For Immunity</h3>
<ul>
<li><strong>Haldi Doodh (Golden Milk):</strong> Warm milk + 1/2 tsp turmeric + pinch of black pepper + honey.</li>
<li><strong>Kadha:</strong> Boil tulsi, ginger, black pepper, clove, cinnamon in water. Powerful immunity booster.</li>
<li><strong>Chyawanprash:</strong> 1 tablespoon daily for overall immunity and vitality.</li>
</ul>
<h3>For Weight Loss</h3>
<ul>
<li><strong>Methi Water:</strong> Soak fenugreek seeds overnight, drink water morning empty stomach.</li>
<li><strong>Dalchini Tea:</strong> Cinnamon stick in boiling water with honey. Regulates blood sugar.</li>
<li><strong>Apple Cider Vinegar:</strong> 1 tbsp in warm water before meals.</li>
</ul>
<h3>For Skin & Hair</h3>
<ul>
<li><strong>Aloe Vera + Turmeric:</strong> Face pack for glowing skin.</li>
<li><strong>Amla (Indian Gooseberry):</strong> Eat 1 daily or drink juice for hair growth and vitamin C.</li>
<li><strong>Coconut Oil + Curry Leaves:</strong> Heat together, apply to scalp for hair fall control.</li>
</ul>`,
      category: 'home_remedies',
      tags: ['ayurveda', 'home remedies', 'natural', 'immunity', 'indian'],
      source: 'indian',
      readTime: 6,
    },
    {
      title: 'Best Chest Workout for Beginners to Advanced',
      summary: 'Complete chest workout guide with exercises for gym and home, targeting upper, mid, and lower chest.',
      content: `<h2>Ultimate Chest Workout Guide</h2>
<h3>Gym Chest Workout</h3>
<ol>
<li><strong>Flat Barbell Bench Press:</strong> 4 sets x 8-12 reps. The king of chest exercises. Focus on controlled movement.</li>
<li><strong>Incline Dumbbell Press:</strong> 3 sets x 10-12 reps. Targets upper chest. 30-45 degree angle.</li>
<li><strong>Decline Bench Press:</strong> 3 sets x 10-12 reps. Targets lower chest.</li>
<li><strong>Cable Flyes:</strong> 3 sets x 12-15 reps. Great for chest stretch and squeeze.</li>
<li><strong>Dips (Chest Version):</strong> 3 sets x 10-15 reps. Lean forward to target chest.</li>
<li><strong>Pec Deck Machine:</strong> 3 sets x 12-15 reps. Isolation movement for finishing.</li>
</ol>
<h3>Home Chest Workout (No Equipment)</h3>
<ol>
<li><strong>Standard Push-ups:</strong> 4 sets x 15-20 reps</li>
<li><strong>Wide Push-ups:</strong> 3 sets x 12-15 reps (targets outer chest)</li>
<li><strong>Diamond Push-ups:</strong> 3 sets x 10-12 reps (targets inner chest)</li>
<li><strong>Decline Push-ups:</strong> 3 sets x 12-15 reps (feet elevated, targets upper chest)</li>
<li><strong>Archer Push-ups:</strong> 3 sets x 8-10 each side</li>
</ol>
<h3>Tips</h3>
<ul>
<li>Always warm up with light sets before heavy lifting</li>
<li>Focus on mind-muscle connection - squeeze the chest</li>
<li>Rest 60-90 seconds between sets</li>
<li>Train chest 2x per week for optimal growth</li>
<li>Progressive overload - increase weight or reps weekly</li>
</ul>`,
      category: 'workout',
      tags: ['chest workout', 'bench press', 'push ups', 'gym', 'home workout'],
      source: 'fitai',
      readTime: 7,
    },
    {
      title: 'Mental Health and Fitness: The Mind-Body Connection',
      summary: 'How exercise improves mental health, reduces anxiety, fights depression, and boosts cognitive function.',
      content: `<h2>Exercise and Mental Health</h2>
<h3>The Science</h3>
<p>Exercise releases endorphins, serotonin, and dopamine - the brain's feel-good chemicals. Regular physical activity has been shown to be as effective as medication for mild to moderate depression.</p>
<h3>Benefits</h3>
<ul>
<li><strong>Reduces Anxiety:</strong> 30 minutes of moderate exercise reduces anxiety symptoms by 20%. Walking, yoga, and swimming are most effective.</li>
<li><strong>Fights Depression:</strong> Regular exercise reduces depression risk by 26%. It increases brain-derived neurotrophic factor (BDNF) which promotes new brain cell growth.</li>
<li><strong>Improves Sleep:</strong> Exercise helps regulate circadian rhythm. Best done 4-6 hours before bedtime.</li>
<li><strong>Boosts Confidence:</strong> Achieving fitness goals builds self-efficacy and body image.</li>
<li><strong>Sharpens Memory:</strong> Aerobic exercise increases hippocampus size, improving memory and learning.</li>
</ul>
<h3>Exercises for Mental Wellness</h3>
<ul>
<li><strong>Yoga & Meditation:</strong> Best for stress, anxiety, and mindfulness</li>
<li><strong>Running/Walking:</strong> "Runner's high" from endorphin release</li>
<li><strong>Strength Training:</strong> Builds confidence and reduces symptoms of depression</li>
<li><strong>Group Sports:</strong> Social connection combined with exercise</li>
<li><strong>Dancing:</strong> Combines physical activity with creative expression</li>
</ul>
<h3>Daily Mental Wellness Routine</h3>
<ol>
<li>5 min morning meditation</li>
<li>30 min exercise (any form)</li>
<li>10 min gratitude journaling</li>
<li>7-8 hours quality sleep</li>
<li>Limit screen time 1 hour before bed</li>
</ol>`,
      category: 'mental_health',
      tags: ['mental health', 'anxiety', 'depression', 'meditation', 'wellness'],
      source: 'fitai',
      readTime: 8,
    },
    {
      title: 'Supplements Guide: What Works and What Doesn\'t',
      summary: 'Evidence-based guide to fitness supplements - whey protein, creatine, BCAAs, multivitamins, and more.',
      content: `<h2>Fitness Supplements Guide</h2>
<h3>Must-Have Supplements</h3>
<ol>
<li><strong>Whey Protein:</strong> 1-2 scoops daily. Best post-workout. Helps meet protein goals. Choose isolate for lactose intolerance.</li>
<li><strong>Creatine Monohydrate:</strong> 5g daily. Most researched supplement. Improves strength, power, and muscle size. No need to cycle.</li>
<li><strong>Vitamin D3:</strong> 2000-4000 IU daily. Most Indians are deficient. Essential for bone health, immunity, and testosterone.</li>
<li><strong>Omega-3 Fish Oil:</strong> 1-2g daily. Reduces inflammation, supports heart and brain health.</li>
</ol>
<h3>Useful But Optional</h3>
<ul>
<li><strong>Multivitamin:</strong> Good insurance policy for micronutrient gaps</li>
<li><strong>Ashwagandha:</strong> 300-600mg daily. Reduces cortisol, improves recovery and sleep. Very popular in Ayurveda.</li>
<li><strong>Magnesium:</strong> 200-400mg before bed. Improves sleep quality and muscle recovery.</li>
</ul>
<h3>Save Your Money (Skip These)</h3>
<ul>
<li><strong>BCAAs:</strong> Unnecessary if you eat enough protein. Whey already has BCAAs.</li>
<li><strong>Fat Burners:</strong> Mostly caffeine with marketing. Just drink black coffee.</li>
<li><strong>Testosterone Boosters:</strong> No OTC supplement significantly boosts testosterone.</li>
<li><strong>Mass Gainers:</strong> Just overpriced sugar. Make your own shake with oats, banana, peanut butter, and whey.</li>
</ul>
<h3>Indian Supplement Alternatives</h3>
<ul>
<li>Sattu powder (Bihar's natural protein shake)</li>
<li>Chyawanprash for immunity</li>
<li>Ashwagandha and Shatavari for recovery</li>
<li>Shilajit for energy and stamina</li>
</ul>`,
      category: 'supplements',
      tags: ['supplements', 'whey protein', 'creatine', 'vitamins', 'ashwagandha'],
      source: 'fitai',
      readTime: 9,
    },
    {
      title: 'Diabetes Prevention Through Diet and Exercise',
      summary: 'How to prevent and manage Type 2 diabetes with proper nutrition, exercise, and lifestyle changes.',
      content: `<h2>Diabetes Prevention and Management</h2>
<h3>Understanding Diabetes</h3>
<p>Type 2 diabetes occurs when your body becomes resistant to insulin or doesn't produce enough. India is the diabetes capital of the world with 77 million diabetics.</p>
<h3>Diet for Diabetes Prevention</h3>
<ul>
<li><strong>Low Glycemic Index Foods:</strong> Brown rice, oats, whole wheat, millets (bajra, ragi, jowar)</li>
<li><strong>High Fiber:</strong> Vegetables, legumes, whole grains (30-40g fiber daily)</li>
<li><strong>Healthy Fats:</strong> Nuts, seeds, olive oil, fish</li>
<li><strong>Protein with every meal:</strong> Slows sugar absorption</li>
</ul>
<h3>Indian Diabetic-Friendly Meals</h3>
<p><strong>Breakfast:</strong> Ragi dosa with coconut chutney OR oats idli OR moong dal chilla</p>
<p><strong>Lunch:</strong> 1 bajra/jowar roti + bitter gourd sabzi + dal + salad</p>
<p><strong>Dinner:</strong> Grilled fish/paneer + sauteed vegetables + small bowl brown rice</p>
<h3>Exercise Protocol</h3>
<ul>
<li>150 minutes moderate cardio per week (walking, cycling)</li>
<li>2-3 strength training sessions per week</li>
<li>Post-meal walking (10-15 min after each meal)</li>
<li>Yoga: Dhanurasana, Paschimottanasana, Mandukasana</li>
</ul>
<h3>Lifestyle Changes</h3>
<ul>
<li>Maintain BMI under 25</li>
<li>Sleep 7-8 hours</li>
<li>Manage stress through meditation</li>
<li>Regular blood sugar monitoring</li>
<li>Limit alcohol and quit smoking</li>
</ul>`,
      category: 'disease_prevention',
      tags: ['diabetes', 'blood sugar', 'prevention', 'indian diet', 'exercise'],
      source: 'fitai',
      readTime: 8,
    },
    {
      title: 'Japanese Diet Secrets for Longevity',
      summary: 'Learn from the world\'s longest-living people - the Japanese approach to eating for health and longevity.',
      content: `<h2>Japanese Diet and Longevity</h2>
<h3>The Okinawan Principle: Hara Hachi Bu</h3>
<p>Eat until you are 80% full. This simple principle from Okinawa (home to the world's longest-living people) naturally reduces calorie intake without counting.</p>
<h3>Core Japanese Diet Elements</h3>
<ul>
<li><strong>Fish:</strong> Rich in omega-3s. Salmon, mackerel, sardines 3-4 times per week</li>
<li><strong>Fermented Foods:</strong> Miso, natto, pickled vegetables for gut health</li>
<li><strong>Green Tea:</strong> 3-5 cups daily. Rich in catechins and antioxidants</li>
<li><strong>Seaweed:</strong> Nori, wakame - rich in iodine and minerals</li>
<li><strong>Tofu and Soy:</strong> Plant-based protein, reduces heart disease risk</li>
<li><strong>Rice:</strong> Moderate portions, often with vegetables</li>
</ul>
<h3>Sample Japanese Day</h3>
<p><strong>Breakfast:</strong> Miso soup + grilled fish + steamed rice + pickled vegetables</p>
<p><strong>Lunch:</strong> Soba noodles + tempura vegetables + green tea</p>
<p><strong>Dinner:</strong> Sashimi + edamame + seaweed salad + small bowl of rice</p>
<h3>Key Takeaways</h3>
<ul>
<li>Eat a variety of foods - Japanese aim for 30 different foods per day</li>
<li>Small portions beautifully presented</li>
<li>Minimal processed foods and sugar</li>
<li>Seasonal and fresh ingredients</li>
<li>Social eating - meals are a time for connection</li>
</ul>`,
      category: 'international_diet',
      tags: ['japanese diet', 'longevity', 'okinawa', 'fish', 'green tea'],
      source: 'international',
      readTime: 7,
    },
    {
      title: 'Complete Guide to Weight Gain for Skinny Guys',
      summary: 'How to gain weight and build muscle if you are underweight - calorie surplus meal plans and workout tips.',
      content: `<h2>Weight Gain Guide for Hardgainers</h2>
<h3>The Math: Calorie Surplus</h3>
<p>To gain weight, eat 300-500 calories above your maintenance level. For a 60kg male: approximately 2500-2800 calories daily.</p>
<h3>Indian Weight Gain Meal Plan (3000 cal)</h3>
<p><strong>Early Morning:</strong> Banana shake with milk, peanut butter, and oats</p>
<p><strong>Breakfast:</strong> 4 paratha with butter + 2 eggs + 1 glass full-fat milk</p>
<p><strong>Mid-Morning:</strong> Handful of dry fruits (almonds, cashews, dates) + banana</p>
<p><strong>Lunch:</strong> 3-4 roti + chicken/paneer curry + dal + rice + curd</p>
<p><strong>Evening:</strong> Peanut butter sandwich + protein shake</p>
<p><strong>Dinner:</strong> 3 roti + rajma/meat curry + rice + ghee</p>
<p><strong>Before Bed:</strong> Milk with badam powder and ghee</p>
<h3>Weight Gain Tips</h3>
<ul>
<li>Eat every 2-3 hours - never skip meals</li>
<li>Add ghee, butter, nuts to increase calorie density</li>
<li>Drink calories: shakes, lassi, full-fat milk</li>
<li>Lift heavy weights 4-5 times per week</li>
<li>Focus on compound exercises: squats, deadlifts, bench press</li>
<li>Sleep 8+ hours for recovery and growth</li>
<li>Track your weight weekly - aim for 0.5 kg gain per week</li>
</ul>
<h3>Affordable Weight Gain Foods (India)</h3>
<ul>
<li>Peanuts and peanut butter</li>
<li>Bananas (cheapest calorie source)</li>
<li>Whole milk and curd</li>
<li>Eggs</li>
<li>Rice and roti</li>
<li>Soya chunks</li>
</ul>`,
      category: 'weight_gain',
      tags: ['weight gain', 'skinny', 'bulk', 'muscle', 'calorie surplus'],
      source: 'fitai',
      readTime: 8,
    },
    {
      title: 'Walking for Weight Loss: The Underrated Exercise',
      summary: 'How walking 10,000 steps daily can transform your health, burn fat, and improve mental well-being.',
      content: `<h2>Walking: The Perfect Exercise</h2>
<h3>Calories Burned Walking</h3>
<ul>
<li><strong>Slow walk (3 km/h):</strong> 200 cal/hour</li>
<li><strong>Brisk walk (5 km/h):</strong> 300 cal/hour</li>
<li><strong>Power walk (6.5 km/h):</strong> 400 cal/hour</li>
<li><strong>10,000 steps:</strong> Approximately 400-500 calories</li>
</ul>
<h3>Walking Program for Beginners</h3>
<p><strong>Week 1-2:</strong> 20 minutes daily, moderate pace</p>
<p><strong>Week 3-4:</strong> 30 minutes daily, brisk pace</p>
<p><strong>Week 5-6:</strong> 40 minutes daily, mix of brisk and intervals</p>
<p><strong>Week 7+:</strong> 45-60 minutes daily, power walking with inclines</p>
<h3>Power Walking Technique</h3>
<ol>
<li>Stand tall, shoulders back</li>
<li>Swing arms naturally at 90 degrees</li>
<li>Land heel first, roll through to toe</li>
<li>Take shorter, quicker steps for speed</li>
<li>Engage your core throughout</li>
</ol>
<h3>Benefits Beyond Weight Loss</h3>
<ul>
<li>Reduces heart disease risk by 30%</li>
<li>Improves joint health (low impact)</li>
<li>Lowers blood pressure</li>
<li>Reduces stress and anxiety</li>
<li>Improves creativity and problem-solving</li>
<li>Free - no gym membership needed</li>
</ul>
<h3>Best Time to Walk</h3>
<p><strong>Morning (6-8 AM):</strong> Best for fat burning (fasted walking)</p>
<p><strong>After meals:</strong> 10-15 min walk reduces blood sugar spikes by 22%</p>
<p><strong>Evening (5-7 PM):</strong> Great for stress relief after work</p>`,
      category: 'wellness',
      tags: ['walking', 'weight loss', 'cardio', 'beginner', 'steps'],
      source: 'fitai',
      readTime: 6,
    },
    {
      title: 'PCOS Diet and Exercise Guide for Indian Women',
      summary: 'Managing PCOS through proper Indian diet, exercise, and lifestyle changes for hormonal balance.',
      content: `<h2>PCOS Management Guide</h2>
<h3>Understanding PCOS</h3>
<p>Polycystic Ovary Syndrome affects 1 in 5 Indian women. Symptoms include irregular periods, weight gain, acne, hair loss, and difficulty conceiving.</p>
<h3>PCOS-Friendly Indian Diet</h3>
<p><strong>Morning:</strong> Methi (fenugreek) water + cinnamon tea</p>
<p><strong>Breakfast:</strong> Ragi dosa with mint chutney OR oats upma with vegetables</p>
<p><strong>Lunch:</strong> 1 jowar/bajra roti + ladies finger sabzi + dal + salad</p>
<p><strong>Snack:</strong> Green tea + roasted makhana</p>
<p><strong>Dinner:</strong> Grilled fish/paneer + vegetable soup + small bowl brown rice</p>
<h3>Foods to Include</h3>
<ul>
<li><strong>Anti-inflammatory:</strong> Turmeric, ginger, leafy greens, berries</li>
<li><strong>Millets:</strong> Ragi, bajra, jowar (low GI, high fiber)</li>
<li><strong>Spearmint tea:</strong> Reduces androgen levels naturally</li>
<li><strong>Flaxseeds:</strong> 1 tbsp daily for hormonal balance</li>
<li><strong>Cinnamon:</strong> Improves insulin sensitivity</li>
</ul>
<h3>Exercise for PCOS</h3>
<ul>
<li><strong>Strength training:</strong> 3x/week - improves insulin sensitivity</li>
<li><strong>Yoga:</strong> Butterfly pose, bridge pose, cycling pose</li>
<li><strong>Moderate cardio:</strong> Brisk walking, swimming 30 min/day</li>
<li><strong>Avoid:</strong> Excessive high-intensity cardio (raises cortisol)</li>
</ul>
<h3>Lifestyle Tips</h3>
<ul>
<li>Maintain a regular sleep schedule (10 PM - 6 AM)</li>
<li>Manage stress through meditation and deep breathing</li>
<li>Limit dairy and sugar</li>
<li>Supplement: Inositol, Vitamin D, Omega-3</li>
</ul>`,
      category: 'disease_prevention',
      tags: ['PCOS', 'women health', 'hormonal balance', 'indian diet', 'exercise'],
      source: 'indian',
      readTime: 9,
    },
  ];
}
