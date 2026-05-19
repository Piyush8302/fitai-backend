const express = require('express');
const router = express.Router();
const { register, login, sendOtp, verifyOtp, googleLogin, googleMobileAuth, googleCallback, getMe, updateProfile, changePassword, forgotPassword, resetPassword, deleteAccount, seedAdmin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & User Profile
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Rahul Sharma" }
 *               email: { type: string, example: "rahul@example.com" }
 *               password: { type: string, example: "123456" }
 *               phone: { type: string, example: "9876543210" }
 *     responses:
 *       201: { description: User registered successfully }
 *       400: { description: Email already exists }
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email & password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "rahul@example.com" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP to phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string, example: "9876543210" }
 *     responses:
 *       200: { description: OTP sent }
 */
router.post('/send-otp', sendOtp);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string, example: "9876543210" }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200: { description: OTP verified }
 */
router.post('/verify-otp', verifyOtp);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Login/Register with Google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               name: { type: string }
 *               avatar: { type: string }
 *               googleId: { type: string }
 *     responses:
 *       200: { description: Google login successful }
 */
router.post('/google', googleLogin);
router.get('/google/mobile', googleMobileAuth);
router.get('/google/callback', googleCallback);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current logged-in user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile }
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update user profile (onboarding)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               age: { type: number, example: 25 }
 *               gender: { type: string, enum: [male, female, other] }
 *               height: { type: number, example: 175 }
 *               weight: { type: number, example: 70 }
 *               targetWeight: { type: number, example: 65 }
 *               activityLevel: { type: string, enum: [sedentary, lightly_active, moderately_active, very_active, extra_active] }
 *               fitnessGoal: { type: string, enum: [weight_loss, weight_gain, muscle_building, fat_loss, height_growth, maintenance, home_workout, gym_workout] }
 *               dietPreference: { type: string, enum: [veg, non_veg, vegan, eggetarian] }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/profile', protect, updateProfile);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password (logged-in user)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: "oldpass123" }
 *               newPassword: { type: string, example: "newpass456" }
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password incorrect }
 */
router.put('/change-password', protect, changePassword);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send password reset OTP to email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "rahul@example.com" }
 *     responses:
 *       200: { description: OTP sent to email }
 *       404: { description: No account with that email }
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, example: "rahul@example.com" }
 *               otp: { type: string, example: "123456" }
 *               newPassword: { type: string, example: "newpass456" }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Invalid or expired OTP }
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /auth/delete-account:
 *   delete:
 *     tags: [Auth]
 *     summary: Deactivate/delete account
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Account deactivated }
 */
router.delete('/delete-account', protect, deleteAccount);

/**
 * @swagger
 * /auth/seed-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Create default admin user (one-time setup)
 *     responses:
 *       201: { description: Admin user created }
 */
router.post('/seed-admin', seedAdmin);

module.exports = router;
