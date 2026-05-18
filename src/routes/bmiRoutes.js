const express = require('express');
const router = express.Router();
const { calculateBMI, getBMIHistory } = require('../controllers/bmiController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: BMI
 *   description: BMI Calculator & Body Analysis
 */

/**
 * @swagger
 * /bmi/calculate:
 *   post:
 *     tags: [BMI]
 *     summary: Calculate BMI, BMR, body fat, daily calories & get suggestions
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [height, weight]
 *             properties:
 *               height: { type: number, example: 175, description: "Height in cm" }
 *               weight: { type: number, example: 70, description: "Weight in kg" }
 *               age: { type: number, example: 25 }
 *               gender: { type: string, enum: [male, female], example: "male" }
 *     responses:
 *       200:
 *         description: Full body analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     bmi: { type: number, example: 22.9 }
 *                     category: { type: string, example: "Normal" }
 *                     bmr: { type: number }
 *                     bodyFat: { type: number }
 *                     dailyCalories: { type: number }
 *                     proteinNeed: { type: number }
 *                     suggestions: { type: array, items: { type: string } }
 */
router.post('/calculate', protect, calculateBMI);

/**
 * @swagger
 * /bmi/history:
 *   get:
 *     tags: [BMI]
 *     summary: Get BMI & weight history (last 30 entries)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: BMI history array }
 */
router.get('/history', protect, getBMIHistory);

module.exports = router;
