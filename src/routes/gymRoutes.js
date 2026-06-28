const express = require('express');
const router = express.Router();
const { protect, ownerOnly, cashbookAccess } = require('../middleware/auth');
const c = require('../controllers/gymController');

// ---- PUBLIC (no login) — walk-in web check-in + avatar image (push thumbnails) ----
router.post('/public/checkin', c.webCheckIn);
router.get('/avatar/:userId', c.getAvatarImage);

// All gym routes below require login
router.use(protect);

// ---- Owner / Staff ----
router.post('/', ownerOnly, c.createGym);            // create gym (owner only)
router.get('/mine', c.getMyGyms);                    // my gyms
// All-branches combined (must be BEFORE /:gymId/* so "all" isn't read as a gymId)
router.get('/all/members', c.getAllMembers);
router.get('/all/dashboard', c.getAllDashboard);
router.get('/all/cashbook', ownerOnly, c.getAllCashbook);
router.post('/members', c.addMember);                // add member

// ---- Staff management (owner only) ----
router.post('/staff', ownerOnly, c.addStaff);                   // add staff
router.post('/staff/attendance', c.markStaffAttendance);        // mark staff present (reception)
router.put('/staff/:staffId', ownerOnly, c.updateStaff);        // edit staff details / reassign gym
router.delete('/staff/:staffId', ownerOnly, c.removeStaff);     // remove staff
router.get('/:gymId/staff', c.getStaff);             // gym staff + today presence
router.get('/:gymId/staff/:staffId/attendance', c.getStaffAttendance); // staff history

router.get('/:gymId/members', c.getMembers);         // gym members
router.get('/:gymId/member/:membershipId', c.getMemberDetail); // full member detail
router.delete('/member/:membershipId', ownerOnly, c.deleteMember); // remove a member (owner only — staff blocked)
router.post('/payment', c.markPayment);              // mark cash payment
router.post('/attendance', c.markAttendance);        // staff scans member QR
router.get('/:gymId/dashboard', c.getGymDashboard);  // stats
router.get('/:gymId/checkin-token', c.getCheckinToken); // fresh time-limited wall-QR token
router.get('/:gymId/kiosk-link', c.getKioskLink);    // long-lived counter-display link
router.get('/:gymId/setloc-link', c.getSetlocLink);  // owner sets gym GPS for geofencing
router.get('/:gymId/attendance', c.getGymAttendance);// attendance list

// ---- Cashbook (owner, or a staff the owner granted cashbook access to) ----
router.post('/cashbook', cashbookAccess, c.addCashEntry);
router.get('/:gymId/cashbook', cashbookAccess, c.getCashbook);
router.delete('/cashbook/:id', cashbookAccess, c.deleteCashEntry);
// ---- Reports stay owner-only ----
router.get('/:gymId/report', ownerOnly, c.getMonthlyReport);

// ---- Member ----
router.get('/my/card', c.getMyCard);                 // membership card + gyms
router.get('/my/:gymId/attendance', c.getMyAttendance); // my history at a gym
router.post('/my/checkin', c.selfCheckIn);           // self check-in via gym QR

module.exports = router;
