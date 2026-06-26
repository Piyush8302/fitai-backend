const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/gymController');

// ---- PUBLIC (no login) — walk-in web check-in + avatar image (push thumbnails) ----
router.post('/public/checkin', c.webCheckIn);
router.get('/avatar/:userId', c.getAvatarImage);

// All gym routes below require login
router.use(protect);

// ---- Owner / Staff ----
router.post('/', c.createGym);                       // create gym
router.get('/mine', c.getMyGyms);                    // my gyms
// All-branches combined (must be BEFORE /:gymId/* so "all" isn't read as a gymId)
router.get('/all/members', c.getAllMembers);
router.get('/all/dashboard', c.getAllDashboard);
router.get('/all/cashbook', c.getAllCashbook);
router.post('/members', c.addMember);                // add member

// ---- Staff (declare specific paths before /:gymId/* so they aren't shadowed) ----
router.post('/staff', c.addStaff);                   // add staff
router.post('/staff/attendance', c.markStaffAttendance); // mark staff present (reception)
router.delete('/staff/:staffId', c.removeStaff);     // remove staff
router.get('/:gymId/staff', c.getStaff);             // gym staff + today presence
router.get('/:gymId/staff/:staffId/attendance', c.getStaffAttendance); // staff history

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
