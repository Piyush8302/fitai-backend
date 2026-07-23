// ─── STAGING seed — dummy gym data for the dev/test environment ──────────────
// Fills an EMPTY test database with one gym owner, one gym, a staff member and a
// spread of members (overdue / due-today / upcoming / paid) so every owner-panel
// feature — fees, unpaid-fee digest, mark payment (cash/online), cashbook,
// create gym, set location — can be tried immediately.
//
// SAFETY: refuses to run unless SEED_STAGING=yes is set, so it can never be
// pointed at the production database by accident.
//
//   Run:  SEED_STAGING=yes MONGODB_URI="<staging uri>" node src/utils/seedStaging.js
//
// Log in on the owner web app with the OWNER phone below. With NODE_ENV=development
// on the staging backend, the OTP is returned in the /api/auth/send-otp response
// (open DevTools → Network), so no SMS is needed.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const User = require('../models/User');
const Gym = require('../models/Gym');
const Membership = require('../models/Membership');

const OWNER_PHONE = '9000000001';
const STAFF_PHONE = '9000000002';

const DAY = 24 * 3600 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

// name, phone, plan, fee, due-date offset in days (negative = overdue)
const MEMBERS = [
  { name: 'Rahul Sharma',  phone: '9000001001', plan: 'monthly',   fee: 1000, due: -5 }, // overdue
  { name: 'Priya Verma',   phone: '9000001002', plan: 'monthly',   fee: 1000, due: 0 },  // due today
  { name: 'Amit Singh',    phone: '9000001003', plan: 'quarterly', fee: 2700, due: 2 },  // due soon (≤3d)
  { name: 'Neha Gupta',    phone: '9000001004', plan: 'monthly',   fee: 1000, due: 20 }, // paid / upcoming
  { name: 'Vikas Yadav',   phone: '9000001005', plan: 'yearly',    fee: 9000, due: 120 },
];

async function run() {
  if (process.env.SEED_STAGING !== 'yes') {
    console.error('✋ Refusing to run: set SEED_STAGING=yes to confirm this is the STAGING database.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const host = mongoose.connection.host;
  console.log(`✅ Connected: ${host}`);
  console.log(`   DB name: ${mongoose.connection.name}\n`);

  // Owner
  let owner = await User.findOne({ phone: OWNER_PHONE });
  if (!owner) {
    owner = await User.create({
      name: 'Test Owner', phone: OWNER_PHONE, role: 'gym_owner',
      ownerStatus: 'approved', authProvider: 'otp', isProfileComplete: true,
    });
    console.log(`✅ Owner created — phone ${OWNER_PHONE}`);
  } else {
    console.log(`• Owner already exists — phone ${OWNER_PHONE}`);
  }

  // Gym
  let gym = await Gym.findOne({ owner: owner._id });
  if (!gym) {
    gym = await Gym.create({
      name: 'Test Fitness Gym', owner: owner._id, location: 'Test Nagar', city: 'Testpur',
      phone: OWNER_PHONE, planPrices: { monthly: 1000, quarterly: 2700, half_yearly: 5000, yearly: 9000 },
    });
    console.log(`✅ Gym created — "${gym.name}" (code ${gym.gymCode})`);
  } else {
    console.log(`• Gym already exists — "${gym.name}" (code ${gym.gymCode})`);
  }

  // Staff (with all permissions so every action is testable)
  let staff = await User.findOne({ phone: STAFF_PHONE });
  if (!staff) {
    staff = await User.create({
      name: 'Test Staff', phone: STAFF_PHONE, role: 'gym_staff', staffGym: gym._id,
      staffRole: 'Receptionist', authProvider: 'otp', isProfileComplete: true,
      canAccessCashbook: true, canAccessReports: true, canAddMember: true,
      canMarkPayment: true, canMarkPresent: true, canManageStatus: true,
      canEditGym: true, canSetLocation: true,
    });
    console.log(`✅ Staff created — phone ${STAFF_PHONE} (all permissions)`);
  } else {
    console.log(`• Staff already exists — phone ${STAFF_PHONE}`);
  }

  // Members + memberships
  let made = 0;
  for (const m of MEMBERS) {
    let u = await User.findOne({ phone: m.phone });
    if (!u) u = await User.create({ name: m.name, phone: m.phone, role: 'user', authProvider: 'otp' });
    const exists = await Membership.findOne({ user: u._id, gym: gym._id });
    if (!exists) {
      await Membership.create({
        user: u._id, gym: gym._id, plan: m.plan, fee: m.fee, status: 'active',
        joinDate: daysFromNow(-30), dueDate: daysFromNow(m.due),
        lastPaidDate: m.due > 10 ? daysFromNow(-10) : undefined, addedBy: owner._id,
      });
      made++;
    }
  }
  console.log(`✅ Members ready — ${made} new, ${MEMBERS.length} total\n`);

  console.log('🎉 Staging seed done. Log in on the owner web app:');
  console.log(`   Owner phone: ${OWNER_PHONE}   Staff phone: ${STAFF_PHONE}`);
  console.log('   (NODE_ENV=development → OTP is returned in the send-otp response)\n');
  process.exit(0);
}

run().catch((e) => { console.error('❌ Seed error:', e.message); process.exit(1); });
