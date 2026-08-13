// ─── Import exercises from free-exercise-db into MongoDB ─────────────────────
// Source: https://github.com/yuhonas/free-exercise-db (MIT, no API key, no limits)
// 870+ exercises with images and step-by-step instructions.
//
//   node src/utils/importExercises.js
//
// Safe to re-run: rows are upserted on `slug`, so it updates rather than
// duplicating. Curated (hand-written) exercises are never overwritten — they
// carry coaching tips the dataset has no equivalent for.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Exercise = require('../models/Exercise');

const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// The source splits legs and back finely; the app groups them. Map onto the
// app's existing taxonomy so no screen has to change.
const MUSCLE_MAP = {
  abdominals: 'abs',
  hamstrings: 'legs', quadriceps: 'legs', adductors: 'legs', abductors: 'legs', calves: 'legs',
  'middle back': 'back', 'lower back': 'back', lats: 'back', traps: 'back',
  chest: 'chest', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps',
  glutes: 'glutes', forearms: 'forearms', neck: 'shoulders',
};

const EQUIPMENT_MAP = {
  'body only': 'bodyweight',
  'e-z curl bar': 'barbell',
  kettlebells: 'kettlebell',
  'medicine ball': 'medicine_ball',
  'exercise ball': 'exercise_ball',
  'foam roll': 'foam_roller',
  barbell: 'barbell', dumbbell: 'dumbbell', cable: 'cable',
  machine: 'machine', bands: 'bands', other: 'other',
};

const LEVEL_MAP = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' };

// Rough calorie cost per set, by how much of the body the movement uses.
const caloriesFor = (muscle, mechanic) => {
  if (muscle === 'legs' || muscle === 'back') return mechanic === 'compound' ? 10 : 7;
  if (muscle === 'chest' || muscle === 'shoulders') return mechanic === 'compound' ? 8 : 6;
  return mechanic === 'compound' ? 7 : 5;
};

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Connected: ${mongoose.connection.host} (db: ${mongoose.connection.name})`);

  console.log('⬇️  Fetching exercise dataset…');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Dataset fetch failed: HTTP ${res.status}`);
  const raw = await res.json();
  console.log(`   got ${raw.length} exercises`);

  // Read the protected slugs once instead of querying per exercise — the
  // per-row version made ~1,700 round trips and took minutes over the network.
  const curatedSlugs = new Set(
    (await Exercise.find({ curated: true }).select('slug').lean()).map((d) => d.slug)
  );

  const ops = [];
  let skipped = 0;
  for (const e of raw) {
    const primary = (e.primaryMuscles || [])[0];
    const muscle = MUSCLE_MAP[primary] || primary || 'full_body';
    const slug = slugify(e.name);

    // Never clobber a hand-written entry.
    if (curatedSlugs.has(slug)) { skipped++; continue; }

    const doc = {
      slug,
      name: e.name,
      muscle,
      secondaryMuscles: (e.secondaryMuscles || []).map((m) => MUSCLE_MAP[m] || m),
      equipment: EQUIPMENT_MAP[e.equipment] || e.equipment || 'other',
      difficulty: LEVEL_MAP[e.level] || 'beginner',
      force: e.force || undefined,
      mechanic: e.mechanic || undefined,
      sets: '3',
      reps: e.mechanic === 'compound' ? '8-12' : '10-15',
      instructions: (e.instructions || []).join(' '),
      caloriesPerSet: caloriesFor(muscle, e.mechanic),
      images: (e.images || []).map((p) => IMAGE_BASE + p),
      curated: false,
      source: 'free-exercise-db',
    };

    ops.push({ updateOne: { filter: { slug }, update: { $set: doc }, upsert: true } });
  }

  // One round trip per 500 rows rather than one per exercise.
  let added = 0, updated = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const r = await Exercise.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    added += r.upsertedCount || 0;
    updated += r.modifiedCount || 0;
    console.log(`   …${Math.min(i + 500, ops.length)}/${ops.length}`);
  }

  const total = await Exercise.countDocuments();
  console.log(`\n✅ Import done — ${added} added, ${updated} updated, ${skipped} curated left alone`);
  console.log(`   exercises in DB: ${total}`);
  process.exit(0);
};

run().catch((e) => { console.error('❌ Import error:', e.message); process.exit(1); });
