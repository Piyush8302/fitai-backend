const express = require('express');
const router = express.Router();
const { protect, ownerOnly, cashbookAccess, reportsAccess } = require('../middleware/auth');
const c = require('../controllers/gymController');

// ---- PUBLIC (no login) — walk-in web check-in + avatar image (push thumbnails) ----
router.post('/public/checkin', c.webCheckIn);
router.get('/avatar/:userId', c.getAvatarImage);

// All gym routes below require login
router.use(protect);

// ---- Owner / Staff ----
router.post('/', ownerOnly, c.createGym);            // create gym (owner only)
router.put('/:gymId', c.updateGym);                  // edit gym (owner, or staff with canEditGym)
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
router.put('/member/:membershipId/status', c.setMemberStatus); // owner, or staff with canManageStatus
router.put('/member/:membershipId/duedate', c.setMemberDueDate); // change next due date (owner / staff with canMarkPayment)
router.post('/payment', c.markPayment);              // mark cash payment
router.post('/attendance', c.markAttendance);        // staff scans member QR
router.get('/:gymId/dashboard', c.getGymDashboard);  // stats
router.get('/:gymId/fees', c.getGymFees);            // fee-due dashboard + filterable list
router.get('/:gymId/checkin-token', c.getCheckinToken); // fresh time-limited wall-QR token
router.get('/:gymId/kiosk-link', c.getKioskLink);    // long-lived counter-display link
router.put('/:gymId/location', c.setGymLocation);    // set gym GPS from the app (owner / staff with canSetLocation)
router.get('/:gymId/setloc-link', c.getSetlocLink);  // DISABLED (410) — legacy web setloc
router.get('/:gymId/attendance', c.getGymAttendance);// attendance list

// ---- Cashbook (owner, or a staff the owner granted cashbook access to) ----
router.post('/cashbook', cashbookAccess, c.addCashEntry);
router.get('/:gymId/cashbook', cashbookAccess, c.getCashbook);
router.delete('/cashbook/:id', cashbookAccess, c.deleteCashEntry);
// ---- Reports (owner, or a staff the owner granted reports access to) ----
router.get('/:gymId/report', reportsAccess, c.getMonthlyReport);

// ---- Member ----
router.get('/my/card', c.getMyCard);                 // membership card + gyms
router.get('/my/:gymId/attendance', c.getMyAttendance); // my history at a gym
router.post('/my/checkin', c.selfCheckIn);           // self check-in via gym QR
router.post('/my/auto-checkin', c.autoCheckIn);      // geofence auto check-in (100m, app closed)

module.exports = router;
