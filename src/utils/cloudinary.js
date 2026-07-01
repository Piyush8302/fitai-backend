// ─── Cloudinary avatar storage (FREE tier) ───────────────────────────────────
// Uploads base64 photos to Cloudinary and stores only the URL, so the DB stays
// tiny (URL ~80 bytes vs ~70 KB base64) → ~10x more members on the free MongoDB.
//
// Set these env vars (Render → Environment) to turn it ON:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// If they are NOT set, everything falls back to the OLD base64-in-DB behavior —
// nothing breaks, so this is safe to deploy before the account is ready.

const cloudinary = require('cloudinary').v2;

const configured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[cloudinary] enabled — avatars will be stored as URLs');
} else {
  console.log('[cloudinary] not configured — falling back to base64 avatars');
}

// Turn an avatar value into something small to store.
//  - base64 data URI + Cloudinary configured  → upload, return the CDN URL
//  - already an http(s) URL                    → pass through unchanged
//  - base64 but NO Cloudinary                  → return the base64 (legacy)
//  - empty / non-string                        → return ''
async function uploadAvatar(input) {
  if (!input || typeof input !== 'string') return input || '';
  if (!input.startsWith('data:')) return input;       // already a URL
  if (!configured) return input;                      // legacy base64 fallback
  try {
    const res = await cloudinary.uploader.upload(input, {
      folder: 'fitai/avatars',
      resource_type: 'image',
      // Keep it small & cheap on the free tier
      transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    });
    return res.secure_url;
  } catch (e) {
    console.error('[cloudinary] upload failed, keeping base64:', e.message);
    return input; // never fail the request — fall back to base64
  }
}

module.exports = { cloudinary, uploadAvatar, cloudinaryConfigured: configured };
