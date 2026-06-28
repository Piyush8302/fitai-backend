// ============================================================================
// Multi-provider OTP SMS service for India.
//
// Pick a provider with the SMS_PROVIDER env var:
//   SMS_PROVIDER=2factor    -> 2Factor.in   (RECOMMENDED — ~₹0.15-0.25 / SMS)
//   SMS_PROVIDER=msg91      -> MSG91        (~₹0.15-0.25 / SMS, needs own DLT template)
//   SMS_PROVIDER=fast2sms   -> Fast2SMS     (legacy; Quick route ≈ ₹5 / SMS — avoid)
//
// Our backend always GENERATES and VERIFIES its own OTP (see authController),
// so a provider only has to DELIVER the value we give it. Nothing in the
// frontend or the verify flow changes when you switch providers.
//
// Required env per provider:
//   2factor : TWOFACTOR_API_KEY, [TWOFACTOR_TEMPLATE_NAME=OTP1]
//   msg91   : MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, [MSG91_SENDER_ID=FITAIO]
//   fast2sms: FAST2SMS_API_KEY
// ============================================================================

const DEFAULT_PROVIDER = process.env.TWOFACTOR_API_KEY ? '2factor'
  : process.env.MSG91_AUTH_KEY ? 'msg91'
  : 'fast2sms';
const PROVIDER = (process.env.SMS_PROVIDER || DEFAULT_PROVIDER).toLowerCase();

const tenDigit = (phone) => String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

// Full OTP message (used by free-form providers like Fast2SMS). Includes the
// SMS-Retriever prefix/app-hash so the app can auto-read it.
const otpMessage = (otp, appHash) => {
  const hash = (appHash || process.env.OTP_APP_HASH || '').trim();
  return `<#> Your FitAI OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.${hash ? `\n${hash}` : ''}`;
};

// ── 2Factor.in — delivers OUR otp value via their DLT-compliant OTP template ──
async function send2Factor(phone, otp) {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  const to = tenDigit(phone);
  if (!apiKey) { console.log(`[SMS:2factor] not configured. OTP for ${to}: ${otp}`); return { success: true, fallback: true }; }
  // Template optional: without one, 2Factor uses your account's DEFAULT OTP template
  // (so you can go live without creating a custom template).
  const tmpl = (process.env.TWOFACTOR_TEMPLATE_NAME || '').trim();
  const base = `https://2factor.in/API/V1/${apiKey}/SMS/+91${to}/${encodeURIComponent(otp)}`;
  const url = tmpl ? `${base}/${encodeURIComponent(tmpl)}` : base;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.Status === 'Success') { console.log(`[SMS:2factor] OTP sent to ${to}`); return { success: true }; }
  console.error('[SMS:2factor] error:', JSON.stringify(data));
  return { success: false, error: data.Details || 'send failed' };
}

// ── MSG91 — Flow API with your DLT template (var1 = OTP) ──
async function sendMsg91(phone, otp) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const to = tenDigit(phone);
  if (!authkey || !process.env.MSG91_TEMPLATE_ID) { console.log(`[SMS:msg91] not configured. OTP for ${to}: ${otp}`); return { success: true, fallback: true }; }
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      sender: process.env.MSG91_SENDER_ID || 'FITAIO',
      recipients: [{ mobiles: `91${to}`, var1: otp }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && (data.type === 'success' || data.message)) { console.log(`[SMS:msg91] OTP sent to ${to}`); return { success: true }; }
  console.error('[SMS:msg91] error:', JSON.stringify(data));
  return { success: false, error: data.message || 'send failed' };
}

// ── Fast2SMS — legacy free-form message (Quick route is expensive) ──
async function sendFast2Sms(phone, otp, appHash) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const to = tenDigit(phone);
  if (!apiKey) { console.log(`[SMS:fast2sms] not configured. OTP for ${to}: ${otp}`); return { success: true, fallback: true }; }
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: 'q', message: otpMessage(otp, appHash), flash: 0, numbers: to }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.return) { console.log(`[SMS:fast2sms] OTP sent to ${to}`); return { success: true }; }
  console.error('[SMS:fast2sms] error:', JSON.stringify(data));
  return { success: false, error: data.message || 'send failed' };
}

// Public API — unchanged signature, so callers don't change.
exports.sendOtpSms = async (phone, otp, appHash) => {
  if (!phone) { console.log('[SMS] skipped: no phone'); return { success: false, error: 'No phone number' }; }
  try {
    switch (PROVIDER) {
      case '2factor': return await send2Factor(phone, otp);
      case 'msg91': return await sendMsg91(phone, otp);
      default: return await sendFast2Sms(phone, otp, appHash);
    }
  } catch (error) {
    console.error(`[SMS:${PROVIDER}] send error:`, error.message);
    return { success: false, error: error.message };
  }
};

exports.SMS_PROVIDER = PROVIDER;
