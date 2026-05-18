const express = require('express');
const router = express.Router();
const { getDietPlans, getDietPlan, getAIDietPlan, createDietPlan, updateDietPlan, deleteDietPlan } = require('../controllers/dietController');
const { protect, admin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Diet
 *   description: Diet plans, meal plans & AI diet generator
 */

/**
 * @swagger
 * /diet:
 *   get:
 *     tags: [Diet]
 *     summary: Get all diet plans with filters
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: goal
 *         schema: { type: string, enum: [weight_loss, weight_gain, muscle_building, maintenance, keto, intermittent_fasting] }
 *       - in: query
 *         name: dietType
 *         schema: { type: string, enum: [veg, non_veg, vegan, eggetarian] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: List of diet plans }
 */
router.get('/', protect, getDietPlans);

/**
 * @swagger
 * /diet/ai-plan:
 *   get:
 *     tags: [Diet]
 *     summary: Get AI personalized Indian diet plan (Breakfast, Lunch, Dinner, Snacks)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: goal
 *         schema: { type: string, enum: [weight_loss, weight_gain, muscle_building, maintenance] }
 *       - in: query
 *         name: dietType
 *         schema: { type: string, enum: [veg, non_veg], default: veg }
 *     responses:
 *       200: { description: AI generated meal plan with Indian foods }
 */
router.get('/ai-plan', protect, getAIDietPlan);

/**
 * @swagger
 * /diet/{id}:
 *   get:
 *     tags: [Diet]
 *     summary: Get single diet plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Diet plan details }
 */
router.get('/:id', protect, getDietPlan);

/**
 * @swagger
 * /diet:
 *   post:
 *     tags: [Diet]
 *     summary: Create diet plan (Admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Diet plan created }
 */
router.post('/', protect, admin, createDietPlan);

/**
 * @swagger
 * /diet/{id}:
 *   put:
 *     tags: [Diet]
 *     summary: Update diet plan (Admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Diet plan updated }
 */
router.put('/:id', protect, admin, updateDietPlan);

/**
 * @swagger
 * /diet/{id}:
 *   delete:
 *     tags: [Diet]
 *     summary: Delete diet plan (Admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Diet plan deleted }
 */
router.delete('/:id', protect, admin, deleteDietPlan);

module.exports = router;
