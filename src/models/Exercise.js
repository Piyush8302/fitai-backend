const mongoose = require('mongoose');

// Exercises are imported from the free-exercise-db dataset (MIT, no API key)
// and cached here, so the app reads them from us: fast, no rate limits, and it
// keeps working if the source is ever unreachable.
//
// The app's existing taxonomy (chest/back/legs…, bodyweight/barbell…) is the
// one stored here — the importer maps the source's finer-grained muscles onto
// it, so screens don't have to change.
const exerciseSchema = new mongoose.Schema({
  // Stable id from the source name, so re-importing updates instead of duplicating
  slug: { type: String, unique: true, index: true },
  name: { type: String, required: true, index: true },
  muscle: { type: String, index: true },          // chest | back | legs | shoulders | biceps | triceps | abs | glutes | …
  secondaryMuscles: [{ type: String }],
  equipment: { type: String, index: true },        // bodyweight | barbell | dumbbell | cable | machine | …
  difficulty: { type: String, index: true },       // beginner | intermediate | advanced
  force: { type: String },                         // push | pull | static
  mechanic: { type: String },                      // compound | isolation
  sets: { type: String },
  reps: { type: String },
  instructions: { type: String },
  tips: { type: String },
  caloriesPerSet: { type: Number },
  images: [{ type: String }],                      // absolute URLs
  // Hand-written entries carry coaching notes the dataset has no equivalent for,
  // so they're surfaced first.
  curated: { type: Boolean, default: false, index: true },
  source: { type: String, default: 'free-exercise-db' },
}, { timestamps: true });

// Text search across name + muscle for the library's search box
exerciseSchema.index({ name: 'text', muscle: 'text' });

module.exports = mongoose.model('Exercise', exerciseSchema);
