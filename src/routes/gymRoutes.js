const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/gymController');

// ---- PUBLIC (no login) — walk-in web check-in ----
router.post('/public/checkin', c.webCheckIn);

// All gym routes below require login
router.use(protect);

// ---- Owner / Staff ----
router.post('/', c.createGym);                       // create gym
router.get('/mine', c.getMyGyms);                    // my gyms
router.post('/members', c.addMember);                // add member
router.get('/:gymId/members', c.getMembers);         // gym members
router.get('/:gymId/member/:membershipId', c.getMemberDetail); // full member detail
router.post('/payment', c.markPayment);              // mark cash payment
router.post('/attendance', c.markAttendance);        // staff scans member QR
router.get('/:gymId/dashboard', c.getGymDashboard);  // stats
router.get('/:gymId/attendance', c.getGymAttendance);// attendance list

// ---- Cashbook & reports ----
router.post('/cashbook', c.addCashEntry);
router.get('/:gymId/cashbook', c.getCashbook);
router.delete('/cashbook/:id', c.deleteCashEntry);
router.get('/:gymId/report', c.getMonthlyReport);

// ---- Member ----
router.get('/my/card', c.getMyCard);                 // membership card + gyms
router.get('/my/:gymId/attendance', c.getMyAttendance); // my history at a gym
router.post('/my/checkin', c.selfCheckIn);           // self check-in via gym QR

module.exports = router;
