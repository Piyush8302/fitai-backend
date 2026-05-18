const express = require('express');
const router = express.Router();
const { getWorkouts, getWorkout, getAIWorkoutPlan, getWeeklySchedule, createWorkout, updateWorkout, deleteWorkout } = require('../controllers/workoutController');
const { protect, admin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Workouts
 *   description: Workout plans, exercises & AI workout generator
 */

/**
 * @swagger
 * /workouts:
 *   get:
 *     tags: [Workouts]
 *     summary: Get all workouts with filters
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [weight_loss, weight_gain, muscle_building, fat_loss, home, gym, stretching, cardio, yoga] }
 *       - in: query
 *         name: difficulty
 *         schema: { type: string, enum: [beginner, intermediate, advanced] }
 *       - in: query
 *         name: muscle
 *         schema: { type: string }
 *         description: Target muscle (chest, back, legs, arms, shoulders, abs)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: List of workouts }
 */
router.get('/', protect, getWorkouts);

/**
 * @swagger
 * /workouts/ai-plan:
 *   get:
 *     tags: [Workouts]
 *     summary: Get AI-generated personalized workout plan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: goal
 *         schema: { type: string, enum: [weight_loss, weight_gain, muscle_building, fat_loss, maintenance] }
 *       - in: query
 *         name: duration
 *         schema: { type: integer, default: 30 }
 *         description: Duration in minutes
 *       - in: query
 *         name: location
 *         schema: { type: string, enum: [home, gym], default: home }
 *     responses:
 *       200: { description: AI generated workout plan with exercises }
 */
router.get('/ai-plan', protect, getAIWorkoutPlan);

/**
 * @swagger
 * /workouts/weekly-schedule:
 *   get:
 *     tags: [Workouts]
 *     summary: Get AI-generated weekly workout schedule
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 7-day workout schedule }
 */
router.get('/weekly-schedule', protect, getWeeklySchedule);

/**
 * @swagger
 * /workouts/{id}:
 *   get:
 *     tags: [Workouts]
 *     summary: Get single workout by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout details }
 */
router.get('/:id', protect, getWorkout);

/**
 * @swagger
 * /workouts:
 *   post:
 *     tags: [Workouts]
 *     summary: Create workout (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category, duration]
 *             properties:
 *               title: { type: string, example: "Fat Burn HIIT" }
 *               category: { type: string, enum: [weight_loss, weight_gain, muscle_building, home, gym] }
 *               difficulty: { type: string, enum: [beginner, intermediate, advanced] }
 *               duration: { type: number, example: 30 }
 *               isPremium: { type: boolean }
 *               exercises: { type: array, items: { type: object } }
 *     responses:
 *       201: { description: Workout created }
 */
router.post('/', protect, admin, createWorkout);

/**
 * @swagger
 * /workouts/{id}:
 *   put:
 *     tags: [Workouts]
 *     summary: Update workout (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout updated }
 */
router.put('/:id', protect, admin, updateWorkout);

/**
 * @swagger
 * /workouts/{id}:
 *   delete:
 *     tags: [Workouts]
 *     summary: Delete workout (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout deleted }
 */
router.delete('/:id', protect, admin, deleteWorkout);

module.exports = router;
