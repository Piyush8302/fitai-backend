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

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏋️ FitAI Backend API is running!',
    version: '1.0.0',
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

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 FitAI Server running on port ${PORT}`);
    console.log(`📋 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}\n`);
  });
};

startServer();

module.exports = app;
