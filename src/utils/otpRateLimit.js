// In-memory per-recipient OTP rate limiting (prevents spam, abuse & duplicate
// requests). Keyed by phone/email. For a single Render instance this is enough;
// move to Redis if you scale to multiple instances.

const COOLDOWN_MS = 45 * 1000;       // min gap between two OTPs to the same number
const WINDOW_MS = 60 * 60 * 1000;    // rolling window
const WINDOW_MAX = 5;                // max OTPs per recipient per hour

const sends = new Map(); // key -> [timestamps]

const recent = (key) => {
  const now = Date.now();
  const arr = (sends.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length) sends.set(key, arr); else sends.delete(key);
  return arr;
};

// Returns { ok } or { ok:false, reason:'cooldown'|'window', wait }
exports.canSendOtp = (key) => {
  if (!key) return { ok: true };
  const now = Date.now();
  const arr = recent(key);
  if (arr.length && now - arr[arr.length - 1] < COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', wait: Math.ceil((COOLDOWN_MS - (now - arr[arr.length - 1])) / 1000) };
  }
  if (arr.length >= WINDOW_MAX) return { ok: false, reason: 'window' };
  return { ok: true };
};

exports.recordOtpSend = (key) => {
  if (!key) return;
  const arr = recent(key);
  arr.push(Date.now());
  sends.set(key, arr);
};

// Periodic cleanup so the map doesn't grow unbounded
const timer = setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of sends) {
    const f = arr.filter((t) => now - t < WINDOW_MS);
    if (f.length) sends.set(k, f); else sends.delete(k);
  }
}, 10 * 60 * 1000);
if (timer.unref) timer.unref();
