const express = require('express');
const router = express.Router();
const { logDaily, getToday, addWater, logMeal, getWeeklyReport, getMonthlyProgress } = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Tracking
 *   description: Daily health tracking - weight, calories, water, sleep, steps, mood
 */

/**
 * @swagger
 * /tracking/today:
 *   get:
 *     tags: [Tracking]
 *     summary: Get today's tracking data
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Today's tracking data }
 */
router.get('/today', protect, getToday);

/**
 * @swagger
 * /tracking/log:
 *   post:
 *     tags: [Tracking]
 *     summary: Log/update daily tracking data
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight: { type: number, example: 70 }
 *               caloriesConsumed: { type: number, example: 1800 }
 *               caloriesBurned: { type: number, example: 400 }
 *               waterIntake: { type: number, example: 6, description: "Glasses" }
 *               steps: { type: number, example: 8000 }
 *               sleepHours: { type: number, example: 7 }
 *               workoutCompleted: { type: boolean }
 *               workoutMinutes: { type: number, example: 45 }
 *               mood: { type: string, enum: [great, good, okay, bad, terrible] }
 *     responses:
 *       200: { description: Tracking updated }
 */
router.post('/log', protect, logDaily);

/**
 * @swagger
 * /tracking/water:
 *   post:
 *     tags: [Tracking]
 *     summary: Add water intake (increment by glasses)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               glasses: { type: number, example: 1, default: 1 }
 *     responses:
 *       200: { description: Water intake updated }
 */
router.post('/water', protect, addWater);

/**
 * @swagger
 * /tracking/meal:
 *   post:
 *     tags: [Tracking]
 *     summary: Log a meal
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mealType: { type: string, enum: [breakfast, lunch, dinner, snack] }
 *               items: { type: array, items: { type: object, properties: { name: { type: string }, calories: { type: number }, protein: { type: number } } } }
 *               totalCalories: { type: number, example: 450 }
 *     responses:
 *       200: { description: Meal logged }
 */
router.post('/meal', protect, logMeal);

/**
 * @swagger
 * /tracking/weekly:
 *   get:
 *     tags: [Tracking]
 *     summary: Get weekly progress report
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Weekly summary with averages }
 */
router.get('/weekly', protect, getWeeklyReport);

/**
 * @swagger
 * /tracking/monthly:
 *   get:
 *     tags: [Tracking]
 *     summary: Get monthly progress data for charts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 30-day tracking data }
 */
router.get('/monthly', protect, getMonthlyProgress);

module.exports = router;
