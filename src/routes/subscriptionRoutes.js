const express = require('express');
const router = express.Router();
const { getPlans, createOrder, verifyPayment, getMySubscription, cancelSubscription } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: Premium subscription management & payments
 */

/**
 * @swagger
 * /subscription/plans:
 *   get:
 *     tags: [Subscription]
 *     summary: Get available subscription plans (₹29/month, ₹249/year)
 *     responses:
 *       200: { description: List of plans with features }
 */
router.get('/plans', getPlans);

/**
 * @swagger
 * /subscription/create-order:
 *   post:
 *     tags: [Subscription]
 *     summary: Create payment order (Razorpay)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan: { type: string, enum: [monthly, yearly], example: "monthly" }
 *     responses:
 *       200: { description: Order created with Razorpay details }
 */
router.post('/create-order', protect, createOrder);

/**
 * @swagger
 * /subscription/verify-payment:
 *   post:
 *     tags: [Subscription]
 *     summary: Verify payment & activate premium
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId: { type: string }
 *               paymentId: { type: string }
 *               signature: { type: string }
 *     responses:
 *       200: { description: Subscription activated }
 */
router.post('/verify-payment', protect, verifyPayment);

/**
 * @swagger
 * /subscription/my:
 *   get:
 *     tags: [Subscription]
 *     summary: Get my subscription status
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subscription details }
 */
router.get('/my', protect, getMySubscription);

/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     tags: [Subscription]
 *     summary: Cancel subscription
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subscription cancelled }
 */
router.post('/cancel', protect, cancelSubscription);

module.exports = router;
