const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FitAI - Health & Fitness API',
      version: '1.0.0',
      description: 'Complete API for FitAI Health & Fitness Application. Includes user auth, BMI tracking, diet plans, workouts, AI chat, and subscription management.',
      contact: { name: 'FitAI Team', email: 'support@fitai.com' },
    },
    servers: [
      { url: '/api', description: 'Current Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
