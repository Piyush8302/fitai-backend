const express = require('express');
const router = express.Router();
const { getArticles, getArticle, getByCategory, getCategories, likeArticle, getTrending, seedArticles } = require('../controllers/articlesController');
const { protect, admin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Articles
 *   description: Health & fitness articles - Indian and International content
 */

/**
 * @swagger
 * /articles:
 *   get:
 *     tags: [Articles]
 *     summary: Get all articles with filters
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [nutrition, workout, wellness, weight_loss, weight_gain, yoga, mental_health, indian_diet, international_diet, supplements, disease_prevention, home_remedies] }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [indian, international, fitai] }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
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
 *       200: { description: Articles list }
 */
router.get('/', getArticles);

/**
 * @swagger
 * /articles/categories:
 *   get:
 *     tags: [Articles]
 *     summary: Get all article categories with counts
 *     responses:
 *       200: { description: Categories list }
 */
router.get('/categories', getCategories);

/**
 * @swagger
 * /articles/trending:
 *   get:
 *     tags: [Articles]
 *     summary: Get trending articles (most viewed)
 *     responses:
 *       200: { description: Trending articles }
 */
router.get('/trending', getTrending);

/**
 * @swagger
 * /articles/seed:
 *   post:
 *     tags: [Articles]
 *     summary: Seed articles database (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Articles seeded }
 */
router.post('/seed', protect, admin, seedArticles);

/**
 * @swagger
 * /articles/category/{category}:
 *   get:
 *     tags: [Articles]
 *     summary: Get articles by category
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Articles by category }
 */
router.get('/category/:category', getByCategory);

/**
 * @swagger
 * /articles/{slug}:
 *   get:
 *     tags: [Articles]
 *     summary: Get single article by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Article detail }
 */
router.get('/:slug', getArticle);

/**
 * @swagger
 * /articles/{id}/like:
 *   put:
 *     tags: [Articles]
 *     summary: Like an article
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Article liked }
 */
router.put('/:id/like', protect, likeArticle);

module.exports = router;
