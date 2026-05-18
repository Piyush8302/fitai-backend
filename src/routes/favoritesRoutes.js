const express = require('express');
const router = express.Router();
const { addFavorite, removeFavorite, getFavorites, checkFavorite, toggleFavorite } = require('../controllers/favoritesController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Favorites
 *   description: Bookmark workouts, diets, articles, and exercises
 */

/**
 * @swagger
 * /favorites:
 *   get:
 *     tags: [Favorites]
 *     summary: Get user favorites
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [workout, diet, article, exercise] }
 *         description: Filter by item type
 *     responses:
 *       200: { description: User favorites }
 */
router.get('/', protect, getFavorites);

/**
 * @swagger
 * /favorites/check:
 *   get:
 *     tags: [Favorites]
 *     summary: Check if item is favorited
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: itemType
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Favorite status }
 */
router.get('/check', protect, checkFavorite);

/**
 * @swagger
 * /favorites:
 *   post:
 *     tags: [Favorites]
 *     summary: Add to favorites
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemType, itemId]
 *             properties:
 *               itemType: { type: string, enum: [workout, diet, article, exercise] }
 *               itemId: { type: string }
 *     responses:
 *       201: { description: Added to favorites }
 */
router.post('/', protect, addFavorite);

/**
 * @swagger
 * /favorites/toggle:
 *   post:
 *     tags: [Favorites]
 *     summary: Toggle favorite (add/remove)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemType, itemId]
 *             properties:
 *               itemType: { type: string, enum: [workout, diet, article, exercise] }
 *               itemId: { type: string }
 *     responses:
 *       200: { description: Toggled }
 */
router.post('/toggle', protect, toggleFavorite);

/**
 * @swagger
 * /favorites/{id}:
 *   delete:
 *     tags: [Favorites]
 *     summary: Remove from favorites
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Removed }
 */
router.delete('/:id', protect, removeFavorite);

module.exports = router;
