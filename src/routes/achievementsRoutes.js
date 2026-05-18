const express = require('express');
const router = express.Router();
const { getAchievements, checkAchievements } = require('../controllers/achievementsController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Achievements
 *   description: Gamification - badges, streaks, milestones
 */

/**
 * @swagger
 * /achievements:
 *   get:
 *     tags: [Achievements]
 *     summary: Get all achievements (locked + unlocked)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Achievement list with unlock status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 unlocked: { type: integer }
 *                 total: { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type: { type: string }
 *                       title: { type: string }
 *                       description: { type: string }
 *                       icon: { type: string }
 *                       isUnlocked: { type: boolean }
 *                       unlockedAt: { type: string, format: date-time, nullable: true }
 */
router.get('/', protect, getAchievements);

/**
 * @swagger
 * /achievements/check:
 *   post:
 *     tags: [Achievements]
 *     summary: Check and unlock new achievements
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Newly unlocked achievements
 */
router.post('/check', protect, checkAchievements);

module.exports = router;
