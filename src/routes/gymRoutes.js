const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/gymController');

// All gym routes require login
router.use(protect);

// ---- Owner / Staff ----
router.post('/', c.createGym);                       // create gym
router.get('/mine', c.getMyGyms);                    // my gyms
router.post('/members', c.addMember);                // add member
router.get('/:gymId/members', c.getMembers);         // gym members
router.post('/payment', c.markPayment);              // mark cash payment
router.post('/attendance', c.markAttendance);        // staff scans member QR
router.get('/:gymId/dashboard', c.getGymDashboard);  // stats
router.get('/:gymId/attendance', c.getGymAttendance);// attendance list

// ---- Member ----
router.get('/my/card', c.getMyCard);                 // membership card + gyms
router.get('/my/:gymId/attendance', c.getMyAttendance); // my history at a gym
router.post('/my/checkin', c.selfCheckIn);           // self check-in via gym QR

module.exports = router;
