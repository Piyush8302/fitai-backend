const express = require('express');
const router = express.Router();
const { getNotifications, markRead, markAllRead, deleteNotification, getUnreadCount, sendNotification, sendDailyTip, savePushToken, webPushKey, webPushSubscribe, webPushUnsubscribe } = require('../controllers/notificationsController');
const { protect, admin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notifications, health tips, reminders
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Notifications list }
 */
router.get('/', protect, getNotifications);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Unread count }
 */
router.get('/unread-count', protect, getUnreadCount);

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All marked as read }
 */
router.put('/read-all', protect, markAllRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark single notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification marked read }
 */
router.put('/:id/read', protect, markRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification deleted }
 */
router.delete('/:id', protect, deleteNotification);

/**
 * @swagger
 * /notifications/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Send notification to user (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title, body]
 *             properties:
 *               userId: { type: string }
 *               title: { type: string }
 *               body: { type: string }
 *               type: { type: string, enum: [reminder, achievement, tip, update, streak, promo] }
 *     responses:
 *       201: { description: Notification sent }
 */
router.post('/push-token', protect, savePushToken);
// Web Push (owner PWA) — public key is safe to expose; subscribe needs login
router.get('/web-push/key', webPushKey);
router.post('/web-push/subscribe', protect, webPushSubscribe);
router.post('/web-push/unsubscribe', protect, webPushUnsubscribe);
router.post('/send', protect, admin, sendNotification);

/**
 * @swagger
 * /notifications/daily-tip:
 *   post:
 *     tags: [Notifications]
 *     summary: Send daily health tip to all users (admin/cron)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tips sent }
 */
router.post('/daily-tip', protect, admin, sendDailyTip);

module.exports = router;
