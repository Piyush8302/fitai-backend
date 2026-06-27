const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');

// Load env
dotenv.config();

// DB Connection
const connectDB = require('./config/db');

// Swagger
const swaggerSpec = require('./config/swagger');

// Init app
const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: 'Too many requests, try again after 15 minutes' } });
app.use('/api/', limiter);

// ============ ROUTES ============

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FitAI API Docs',
}));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bmi', require('./routes/bmiRoutes'));
app.use('/api/workouts', require('./routes/workoutRoutes'));
app.use('/api/diet', require('./routes/dietRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/articles', require('./routes/articlesRoutes'));
app.use('/api/food', require('./routes/foodRoutes'));
app.use('/api/exercises', require('./routes/exerciseRoutes'));
app.use('/api/favorites', require('./routes/favoritesRoutes'));
app.use('/api/achievements', require('./routes/achievementsRoutes'));
app.use('/api/notifications', require('./routes/notificationsRoutes'));
app.use('/api/gym', require('./routes/gymRoutes'));
// Public gym check-in page (static QR, scanned by any phone camera)
const gymC = require('./controllers/gymController');
app.get('/g/setloc/:token', gymC.gymSetlocPage);     // owner sets gym GPS location
app.post('/g/setloc/:token', gymC.gymSetlocSave);
app.get('/g/kiosk/:token/qr', gymC.gymKioskQr);      // (legacy) auto-refreshing QR image
app.get('/g/kiosk/:token', gymC.gymKioskPage);       // (legacy) counter display page
app.get('/g/t/:token', gymC.gymTokenPage);           // (legacy) expiring-token scan
app.get('/g/:gymCode', gymC.gymPublicPage);          // static QR → geofenced check-in
app.get('/g/:gymCode/manifest.json', gymC.gymManifest);
app.post('/g/:gymCode/checkin', gymC.gymGeoCheckin); // receives GPS, validates distance
app.post('/g/:gymCode/submit', gymC.gymPublicSubmit);
app.post('/g/:gymCode/register', gymC.gymPublicRegister);

// ===== PWA assets for the gym check-in page (installable web app) =====
app.get('/gym-icon.svg', (req, res) => {
  res.type('image/svg+xml').send(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="#6C63FF"/><text x="50%" y="54%" font-size="300" text-anchor="middle" dominant-baseline="middle">🏋️</text></svg>`
  );
});
app.get('/gym-manifest.json', (req, res) => {
  res.json({
    name: 'FitAI Gym Check-in',
    short_name: 'FitAI Gym',
    description: 'Quick gym attendance check-in',
    start_url: '.',
    scope: '/',
    display: 'standalone',
    background_color: '#151725',
    theme_color: '#6C63FF',
    icons: [
      { src: '/gym-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/gym-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  });
});
app.get('/gym-sw.js', (req, res) => {
  res.type('application/javascript').send(
    `self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',e=>{});`
  );
});
app.get('/gym-app.js', (req, res) => {
  res.type('application/javascript').send(
    `if('serviceWorker' in navigator){navigator.serviceWorker.register('/gym-sw.js').catch(function(){});}
var dp=null,b=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e;if(b)b.style.display='block';});
if(b){b.addEventListener('click',function(){if(dp){dp.prompt();dp=null;b.style.display='none';}});}
window.addEventListener('appinstalled',function(){if(b)b.style.display='none';});`
  );
});

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏋️ FitAI Backend API is running!',
    version: '2.1.0',
    docs: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      bmi: '/api/bmi',
      workouts: '/api/workouts',
      diet: '/api/diet',
      tracking: '/api/tracking',
      chat: '/api/chat',
      subscription: '/api/subscription',
      admin: '/api/admin',
      articles: '/api/articles',
      food: '/api/food',
      exercises: '/api/exercises',
      favorites: '/api/favorites',
      achievements: '/api/achievements',
      notifications: '/api/notifications',
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

// Auto-seed articles when collection is empty (app never shows blank Articles screen)
const autoSeedArticles = async () => {
  try {
    const Article = require('./models/Article');
    const { getSeedArticlesData } = require('./controllers/articlesController');
    const count = await Article.countDocuments();
    if (count === 0 && typeof getSeedArticlesData === 'function') {
      const articles = getSeedArticlesData();
      await Article.insertMany(articles);
      console.log(`📰 Auto-seeded ${articles.length} articles`);
    }
  } catch (e) {
    console.log('Article auto-seed skipped:', e.message);
  }
};

// Notification schedulers (IST). Calorie check 9 PM; gym fee reminders 10 AM & 6 PM.
let lastCalorieCheckDate = null;
const lastGymReminder = {}; // { '10': 'YYYY-MM-DD', '18': 'YYYY-MM-DD' }
const startCalorieCheckScheduler = () => {
  setInterval(async () => {
    try {
      const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const today = ist.toISOString().split('T')[0];
      const hour = ist.getUTCHours();
      const notif = require('./controllers/notificationsController');

      // Daily calorie target — 9 PM IST
      if (hour === 21 && lastCalorieCheckDate !== today) {
        lastCalorieCheckDate = today;
        await notif.runDailyCalorieCheck();
      }
      // Gym fee reminders — twice a day (10 AM & 6 PM IST)
      for (const slot of [10, 18]) {
        if (hour === slot && lastGymReminder[slot] !== today) {
          lastGymReminder[slot] = today;
          await notif.runGymFeeReminders();
        }
      }
    } catch (e) { console.log('Scheduler error:', e.message); }
  }, 10 * 60 * 1000); // check every 10 minutes
};

const startServer = async () => {
  await connectDB();
  await autoSeedArticles();
  startCalorieCheckScheduler();
  app.listen(PORT, () => {
    console.log(`\n🚀 FitAI Server running on port ${PORT}`);
    console.log(`📋 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}\n`);
  });
};

startServer();

module.exports = app;
