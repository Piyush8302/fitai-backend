const express = require('express');
const router = express.Router();
const { getExercises, getExerciseById, getByMuscle, getMuscleGroups, getExerciseImage } = require('../controllers/exerciseController');

/**
 * @swagger
 * tags:
 *   name: Exercise Library
 *   description: Complete exercise database with instructions, sets, reps and tips
 */

/**
 * @swagger
 * /exercises:
 *   get:
 *     tags: [Exercise Library]
 *     summary: Get all exercises with filters
 *     parameters:
 *       - in: query
 *         name: muscle
 *         schema: { type: string, enum: [chest, back, legs, shoulders, biceps, triceps, abs, glutes, full_body] }
 *       - in: query
 *         name: equipment
 *         schema: { type: string, enum: [barbell, dumbbell, bodyweight, cable, machine, jump_rope] }
 *       - in: query
 *         name: difficulty
 *         schema: { type: string, enum: [beginner, intermediate, advanced] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Exercise list }
 */
router.get('/', getExercises);

/**
 * @swagger
 * /exercises/muscles:
 *   get:
 *     tags: [Exercise Library]
 *     summary: Get all muscle groups with exercise counts
 *     responses:
 *       200: { description: Muscle groups }
 */
router.get('/muscles', getMuscleGroups);

/**
 * @swagger
 * /exercises/muscle/{muscle}:
 *   get:
 *     tags: [Exercise Library]
 *     summary: Get exercises by muscle group
 *     parameters:
 *       - in: path
 *         name: muscle
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Exercises for muscle }
 */
router.get('/muscle/:muscle', getByMuscle);

/**
 * @swagger
 * /exercises/{slug}/image/{idx}:
 *   get:
 *     tags: [Exercise Library]
 *     summary: Exercise photo, streamed through this server
 *     description: Served from here rather than linking to the upstream host, which some devices and networks fail to load.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: idx
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Image bytes }
 */
router.get('/:slug/image/:idx', getExerciseImage);

/**
 * @swagger
 * /exercises/{id}:
 *   get:
 *     tags: [Exercise Library]
 *     summary: Get exercise details by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Exercise details }
 */
router.get('/:id', getExerciseById);

module.exports = router;
