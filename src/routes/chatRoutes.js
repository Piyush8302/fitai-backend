const express = require('express');
const router = express.Router();
const { sendMessage, getChatHistory, clearChat, getSuggestions } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: AI Chat
 *   description: Smart AI Health Assistant - ask about diet, workouts, health tips
 */

/**
 * @swagger
 * /chat/send:
 *   post:
 *     tags: [AI Chat]
 *     summary: Send message to AI Health Assistant
 *     description: "Ask anything: What should I eat? How to lose weight? Best chest exercises? How much protein do I need?"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "How can I lose belly fat?" }
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reply: { type: string }
 */
router.post('/send', protect, sendMessage);

/**
 * @swagger
 * /chat/history:
 *   get:
 *     tags: [AI Chat]
 *     summary: Get chat history
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Chat messages }
 */
router.get('/history', protect, getChatHistory);

/**
 * @swagger
 * /chat/clear:
 *   delete:
 *     tags: [AI Chat]
 *     summary: Clear chat history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Chat cleared }
 */
router.delete('/clear', protect, clearChat);

/**
 * @swagger
 * /chat/suggestions:
 *   get:
 *     tags: [AI Chat]
 *     summary: Get personalized quick-reply suggestions
 *     description: Returns smart suggestions based on user's fitness goal, time of day, and profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Suggestions list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { type: string }
 */
router.get('/suggestions', protect, getSuggestions);

module.exports = router;
