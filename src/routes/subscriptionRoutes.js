const express = require('express');
const router = express.Router();
const {
  getPlans,
  createOrder,
  verifyPayment,
  checkoutPage,
  checkoutCallback,
  getMySubscription,
  cancelSubscription,
  upiPay,
  upiConfirm,
  cashfreePay,
  cashfreeWebhook,
  cashfreeStatus,
} = require('../controllers/subscriptionController');
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
 *     summary: Get available subscription plans
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
 */
router.post('/verify-payment', protect, verifyPayment);

/**
 * @swagger
 * /subscription/checkout/{subscriptionId}:
 *   get:
 *     tags: [Subscription]
 *     summary: Checkout page (HTML with Razorpay embedded) for Expo WebBrowser
 */
router.get('/checkout/:subscriptionId', checkoutPage);

/**
 * @swagger
 * /subscription/checkout-callback/{subscriptionId}:
 *   post:
 *     tags: [Subscription]
 *     summary: Razorpay redirect callback after payment
 */
router.post('/checkout-callback/:subscriptionId', checkoutCallback);

/**
 * @swagger
 * /subscription/my:
 *   get:
 *     tags: [Subscription]
 *     summary: Get my subscription status
 *     security: [{ bearerAuth: [] }]
 */
router.get('/my', protect, getMySubscription);

/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     tags: [Subscription]
 *     summary: Cancel subscription
 *     security: [{ bearerAuth: [] }]
 */
router.post('/cancel', protect, cancelSubscription);

// === UPI Direct Payment ===
router.post('/upi-pay', protect, upiPay);
router.post('/upi-confirm', protect, upiConfirm);

// === Cashfree UPI Collect ===
router.post('/cashfree-pay', protect, cashfreePay);
router.post('/cashfree-webhook', cashfreeWebhook); // No auth — Cashfree calls this
router.get('/cashfree-status/:orderId', protect, cashfreeStatus);

module.exports = router;
