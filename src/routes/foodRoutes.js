const express = require('express');
const router = express.Router();
const { searchFood, getFoodById, getFoodCategories, calculateMeal } = require('../controllers/foodController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Food Database
 *   description: Searchable food & calorie database - Indian and International foods
 */

/**
 * @swagger
 * /food:
 *   get:
 *     tags: [Food Database]
 *     summary: Search food database
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search query (name or Hindi name)
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [grains, pulses, dairy, protein, curry, rice_dish, breakfast, snacks, fats, beverages, fruits, vegetables, nuts, supplements, dessert, sides] }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [indian, international] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Food search results }
 */
router.get('/', searchFood);

/**
 * @swagger
 * /food/categories:
 *   get:
 *     tags: [Food Database]
 *     summary: Get food categories with counts
 *     responses:
 *       200: { description: Food categories }
 */
router.get('/categories', getFoodCategories);

/**
 * @swagger
 * /food/calculate:
 *   post:
 *     tags: [Food Database]
 *     summary: Calculate meal calories & macros
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     foodId: { type: integer, example: 1 }
 *                     quantity: { type: number, example: 100, description: "Quantity in grams" }
 *     responses:
 *       200: { description: Calculated meal nutrition }
 */
router.post('/calculate', protect, calculateMeal);

/**
 * @swagger
 * /food/{id}:
 *   get:
 *     tags: [Food Database]
 *     summary: Get food details by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Food details }
 */
router.get('/:id', getFoodById);

module.exports = router;
