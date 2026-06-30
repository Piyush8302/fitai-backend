const express = require('express');
const router = express.Router();
const { getDashboard, getUsers, getUser, togglePremium, deactivateUser, updateUserContact, getSubscriptions, approvePayment, rejectPayment, getOwnerRequests, approveOwnerRequest, rejectOwnerRequest } = require('../controllers/adminController');
const { getMessages, resolveMessage, deleteMessage } = require('../controllers/supportController');
const { protect, admin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin panel - manage users, subscriptions, analytics
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin dashboard stats
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard with total users, revenue, etc }
 */
router.get('/dashboard', protect, admin, getDashboard);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users (with search & filter)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isPremium
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: List of users }
 */
router.get('/users', protect, admin, getUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user details with subscriptions & tracking
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User details }
 */
router.get('/users/:id', protect, admin, getUser);

/**
 * @swagger
 * /admin/users/{id}/toggle-premium:
 *   put:
 *     tags: [Admin]
 *     summary: Toggle user premium status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Premium toggled }
 */
router.put('/users/:id/toggle-premium', protect, admin, togglePremium);

/**
 * @swagger
 * /admin/users/{id}/deactivate:
 *   put:
 *     tags: [Admin]
 *     summary: Deactivate user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User deactivated }
 */
router.put('/users/:id/deactivate', protect, admin, deactivateUser);
router.put('/users/:id/contact', protect, admin, updateUserContact);

/**
 * @swagger
 * /admin/subscriptions:
 *   get:
 *     tags: [Admin]
 *     summary: Get all subscriptions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, active, expired, cancelled] }
 *     responses:
 *       200: { description: List of subscriptions }
 */
router.get('/subscriptions', protect, admin, getSubscriptions);
router.put('/subscriptions/:id/approve', protect, admin, approvePayment);
router.put('/subscriptions/:id/reject', protect, admin, rejectPayment);

// Gym-owner approval workflow
router.get('/owner-requests', protect, admin, getOwnerRequests);
router.put('/owner-requests/:userId/approve', protect, admin, approveOwnerRequest);
router.put('/owner-requests/:userId/reject', protect, admin, rejectOwnerRequest);

// Support / Contact Us messages
router.get('/support', protect, admin, getMessages);
router.put('/support/:id/resolve', protect, admin, resolveMessage);
router.delete('/support/:id', protect, admin, deleteMessage);

module.exports = router;
