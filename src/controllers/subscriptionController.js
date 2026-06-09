const Subscription = require('../models/Subscription');
const User = require('../models/User');
const crypto = require('crypto');
const nodeFetch = require('node-fetch');
const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : nodeFetch;

// Cashfree config
const getCashfreeConfig = () => ({
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  baseUrl: process.env.CASHFREE_ENV === 'PROD'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg',
});

// Lazy-init Razorpay (only when keys exist)
let razorpayInstance = null;
const getRazorpay = () => {
  if (razorpayInstance) return razorpayInstance;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  const Razorpay = require('razorpay');
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpayInstance;
};

// UPI Config
const UPI_ID = process.env.UPI_ID || '9889808605@slc';
const UPI_NAME = process.env.UPI_NAME || 'FitAI Premium';

const PLANS = {
  monthly: { price: 29, duration: '1 Month', label: 'Monthly', days: 30 },
  yearly: { price: 299, duration: '1 Year', label: 'Yearly', days: 365, originalPrice: 348, savings: '14% OFF' },
};

// @desc    Get subscription plans
exports.getPlans = async (req, res, next) => {
  try {
    const plans = [
      {
        id: 'monthly',
        name: 'Premium Monthly',
        price: PLANS.monthly.price,
        currency: 'INR',
        duration: PLANS.monthly.duration,
        features: [
          'Unlimited AI Chat (no daily limit)',
          'Personalized AI Diet Plans',
          'Advanced Progress Analytics',
          'Priority Support',
          'Ad-Free Experience',
        ],
      },
      {
        id: 'yearly',
        name: 'Premium Yearly',
        price: PLANS.yearly.price,
        originalPrice: PLANS.yearly.originalPrice,
        currency: 'INR',
        duration: PLANS.yearly.duration,
        savings: PLANS.yearly.savings,
        features: [
          'Everything in Monthly',
          'Yearly Progress Reports',
          'Exclusive Workout Challenges',
          'Early Access to New Features',
        ],
      },
    ];
    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
};

// @desc    Start UPI payment — returns UPI intent URL
exports.upiPay = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Use monthly or yearly.' });
    }

    const amount = PLANS[plan].price;
    const txnId = `FITAI${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Create pending subscription
    const subscription = await Subscription.create({
      user: req.user.id,
      plan,
      amount: amount * 100, // store in paisa
      status: 'pending',
      paymentMethod: 'upi',
      upiTransactionId: txnId,
    });

    // Build UPI intent URL
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`FitAI ${PLANS[plan].label} Plan`)}&tr=${txnId}`;

    res.json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        upiUrl,
        upiId: UPI_ID,
        amount,
        plan,
        txnId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cashfree Payment Link — user pays via GPay/PhonePe on Cashfree page
exports.cashfreePay = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan || !PLANS[plan]) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const cf = getCashfreeConfig();
    if (!cf.appId) return res.status(500).json({ success: false, message: 'Payment gateway not configured' });

    const amount = PLANS[plan].price;
    const linkId = `FITAI_${req.user.id.toString().slice(-6)}_${Date.now()}`;

    const CF_HEADERS = {
      'Content-Type': 'application/json',
      'x-client-id': cf.appId,
      'x-client-secret': cf.secretKey,
      'x-api-version': '2022-09-01',
    };

    // Create Cashfree Payment Link
    const linkRes = await fetchFn(`${cf.baseUrl}/links`, {
      method: 'POST',
      headers: CF_HEADERS,
      body: JSON.stringify({
        link_id: linkId,
        link_amount: amount,
        link_currency: 'INR',
        link_purpose: `FitAI ${PLANS[plan].label} Premium`,
        customer_details: {
          customer_name: req.user.name || 'FitAI User',
          customer_email: req.user.email || 'user@fitai.com',
          customer_phone: req.user.phone || '9999999999',
        },
        link_notify: { send_sms: false, send_email: false },
        link_meta: { upi_intent: true },
        link_notes: { userId: req.user.id, plan },
      }),
    });
    const linkData = await linkRes.json();
    if (!linkRes.ok) {
      console.log('[Cashfree] Link error:', JSON.stringify(linkData));
      return res.status(400).json({ success: false, message: linkData.message || 'Failed to create payment link' });
    }

    // Save subscription
    const subscription = await Subscription.create({
      user: req.user.id,
      plan,
      amount: amount * 100,
      status: 'pending',
      paymentMethod: 'upi',
      orderId: linkId,
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        linkId,
        paymentUrl: linkData.link_url,
        amount,
      },
    });
  } catch (error) {
    console.log('[Cashfree] Error:', error.message);
    next(error);
  }
};

// @desc    Cashfree webhook — auto-verify payment
exports.cashfreeWebhook = async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.order || !data.payment) return res.json({ success: true });

    const orderId = data.order.order_id;
    const paymentStatus = data.payment.payment_status;

    console.log(`[Cashfree Webhook] Order: ${orderId}, Status: ${paymentStatus}`);

    if (paymentStatus === 'SUCCESS') {
      const subscription = await Subscription.findOne({ orderId });
      if (!subscription || subscription.status === 'active') return res.json({ success: true });

      const startDate = new Date();
      const endDate = new Date();
      if (subscription.plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      subscription.status = 'active';
      subscription.paymentId = data.payment.cf_payment_id;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();

      await User.findByIdAndUpdate(subscription.user, {
        isPremium: true,
        subscriptionPlan: subscription.plan,
        subscriptionExpiry: endDate,
      });

      console.log(`[Cashfree] Premium activated for user ${subscription.user}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.log('[Cashfree Webhook] Error:', error.message);
    res.json({ success: true }); // Always return 200 to Cashfree
  }
};

// @desc    Check Cashfree payment status (polling from app)
exports.cashfreeStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const subscription = await Subscription.findOne({ orderId, user: req.user.id });
    if (!subscription) return res.status(404).json({ success: false, message: 'Order not found' });

    // If already active, return immediately
    if (subscription.status === 'active') {
      return res.json({ success: true, data: { status: 'active', subscription } });
    }

    // Check with Cashfree link status
    const cf = getCashfreeConfig();
    const statusRes = await fetchFn(`${cf.baseUrl}/links/${orderId}`, {
      headers: {
        'x-client-id': cf.appId,
        'x-client-secret': cf.secretKey,
        'x-api-version': '2022-09-01',
      },
    });
    const statusData = await statusRes.json();

    if (statusData.link_status === 'PAID' && subscription.status !== 'active') {
      // Activate premium
      const startDate = new Date();
      const endDate = new Date();
      if (subscription.plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();

      await User.findByIdAndUpdate(subscription.user, {
        isPremium: true,
        subscriptionPlan: subscription.plan,
        subscriptionExpiry: endDate,
      });
    }

    res.json({
      success: true,
      data: {
        status: subscription.status === 'active' ? 'active' : statusData.link_status?.toLowerCase() || 'pending',
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    User confirms UPI payment with UTR number
exports.upiConfirm = async (req, res, next) => {
  try {
    const { subscriptionId, utrNumber, upiApp } = req.body;
    if (!subscriptionId || !utrNumber) {
      return res.status(400).json({ success: false, message: 'subscriptionId and utrNumber required' });
    }

    const subscription = await Subscription.findOne({ _id: subscriptionId, user: req.user.id });
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (subscription.status === 'active') return res.json({ success: true, message: 'Already activated' });

    subscription.utrNumber = utrNumber.trim();
    if (upiApp) subscription.upiApp = upiApp;
    await subscription.save();

    res.json({ success: true, message: 'Payment submitted! Admin will verify and activate your premium shortly.', data: subscription });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay order
exports.createOrder = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Use monthly or yearly.' });
    }

    const amount = plan === 'yearly' ? 24900 : 2900; // paisa
    const razorpay = getRazorpay();

    let orderId;
    if (razorpay) {
      try {
        const order = await razorpay.orders.create({
          amount,
          currency: 'INR',
          receipt: `fi_${Date.now()}`,
          notes: { userId: req.user.id, plan },
        });
        orderId = order.id;
      } catch (rzpErr) {
        console.error('Razorpay order error:', JSON.stringify(rzpErr));
        const desc = rzpErr?.error?.description || rzpErr?.message || 'Payment service error';
        return res.status(502).json({ success: false, message: desc });
      }
    } else {
      orderId = 'order_test_' + Date.now();
      console.log('Razorpay keys not configured. Using test order:', orderId);
    }

    const subscription = await Subscription.create({
      user: req.user.id,
      plan,
      amount,
      status: 'pending',
      orderId,
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        orderId,
        amount: amount / 100,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        userName: req.user.name,
        userEmail: req.user.email,
        userPhone: req.user.phone || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay payment & activate premium
exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, message: 'orderId and paymentId required' });
    }

    // Verify signature if Razorpay is configured
    if (process.env.RAZORPAY_KEY_SECRET && signature) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      if (expectedSig !== signature) {
        return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
      }
    }

    const subscription = await Subscription.findOne({ orderId });
    if (!subscription) return res.status(404).json({ success: false, message: 'Order not found' });
    if (subscription.status === 'active') return res.json({ success: true, message: 'Already activated', data: subscription });

    const startDate = new Date();
    const endDate = new Date();
    if (subscription.plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    subscription.status = 'active';
    subscription.paymentId = paymentId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    await subscription.save();

    await User.findByIdAndUpdate(subscription.user, {
      isPremium: true,
      subscriptionPlan: subscription.plan,
      subscriptionExpiry: endDate,
    });

    res.json({ success: true, message: 'Premium activated!', data: subscription });
  } catch (error) {
    next(error);
  }
};

// @desc    Checkout page (HTML form that redirects to Razorpay) - for Expo WebBrowser
exports.checkoutPage = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await Subscription.findById(subscriptionId).populate('user', 'name email phone');
    if (!subscription) return res.status(404).send('Order not found');

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    if (subscription.status === 'active') {
      return res.send(`<html><body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#4CAF50">Premium Already Active!</h2><p style="color:#888">You can close this page.</p></div></body></html>`);
    }

    const key = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const callbackUrl = `${baseUrl}/api/subscription/checkout-callback/${subscriptionId}`;
    const safeName = (subscription.user.name || '').replace(/['"\\&<>]/g, '');
    const safeEmail = (subscription.user.email || '').replace(/['"\\&<>]/g, '');
    const safePhone = (subscription.user.phone || '').replace(/['"\\&<>]/g, '');
    const planLabel = subscription.plan === 'yearly' ? 'Yearly' : 'Monthly';
    const priceDisplay = subscription.amount / 100;

    // Use Razorpay's standard checkout with callback_url for redirect mode
    const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FitAI Premium - Pay</title>
<style>
body{font-family:system-ui;background:#0D0D1A;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{background:#1A1A2E;border-radius:16px;padding:30px;max-width:400px;width:100%;text-align:center;border:1px solid #6C63FF30}
h1{color:#6C63FF;font-size:22px;margin:0 0 4px}
.price{font-size:32px;font-weight:bold;margin:16px 0 4px}
.plan{color:#888;font-size:14px;margin-bottom:20px}
.features{text-align:left;margin:0 0 20px;font-size:14px;color:#ccc;line-height:2.2;padding-left:20px}
.features li::marker{color:#6C63FF}
.pay-btn{background:linear-gradient(135deg,#6C63FF,#4834DF);color:#fff;border:none;padding:16px;border-radius:12px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px}
.pay-btn:disabled{opacity:0.6}
.secure{color:#666;font-size:12px;margin-top:16px}
.msg{color:#6C63FF;font-size:14px;margin-top:12px;display:none}
.err{color:#FF6B6B;font-size:13px;margin-top:12px;display:none}
</style>
</head><body>
<div class="card">
<h1>FitAI Premium</h1>
<div class="price">${priceDisplay} <span style="font-size:16px;color:#888">/${subscription.plan === 'yearly' ? 'year' : 'month'}</span></div>
<div class="plan">${planLabel} Plan</div>
<ul class="features">
<li>Unlimited AI Chat</li>
<li>Personalized Diet Plans</li>
<li>Advanced Analytics</li>
<li>Ad-Free Experience</li>
<li>Priority Support</li>
</ul>
<button class="pay-btn" id="payBtn" onclick="pay()">Pay ${priceDisplay}</button>
<div class="msg" id="msg">Redirecting to payment...</div>
<div class="err" id="err"></div>
<div class="secure">Secured by Razorpay</div>
</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function pay(){
var btn=document.getElementById('payBtn');
var msg=document.getElementById('msg');
var err=document.getElementById('err');
btn.disabled=true;
msg.style.display='block';
err.style.display='none';
try{
if(typeof Razorpay==='undefined'){
err.textContent='Payment SDK loading, please wait...';
err.style.display='block';
msg.style.display='none';
btn.disabled=false;
setTimeout(pay,2000);
return;
}
var rzp=new Razorpay({
key:'${key}',
amount:${subscription.amount},
currency:'INR',
name:'FitAI Premium',
description:'${planLabel} Subscription',
order_id:'${subscription.orderId}',
callback_url:'${callbackUrl}',
prefill:{name:'${safeName}',email:'${safeEmail}',contact:'${safePhone}'},
theme:{color:'#6C63FF'},
notes:{subscriptionId:'${subscriptionId}'}
});
rzp.open();
}catch(e){
err.textContent='Error: '+e.message;
err.style.display='block';
msg.style.display='none';
btn.disabled=false;
}
}
</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

// @desc    Checkout callback (Razorpay redirects here after payment)
exports.checkoutCallback = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    // Razorpay sends payment data as POST body
    const paymentId = req.body.razorpay_payment_id;
    const orderId = req.body.razorpay_order_id;
    const signature = req.body.razorpay_signature;

    if (!paymentId || !orderId) {
      return res.send(`<html><body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#FF6B6B">Payment Failed</h2><p style="color:#888">No payment received. Please try again.</p></div></body></html>`);
    }

    // Verify signature
    if (process.env.RAZORPAY_KEY_SECRET && signature) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      if (expectedSig !== signature) {
        return res.send(`<html><body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#FF6B6B">Verification Failed</h2><p style="color:#888">Payment signature mismatch. Contact support.</p></div></body></html>`);
      }
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.send(`<html><body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#FF6B6B">Order Not Found</h2></div></body></html>`);
    }

    if (subscription.status !== 'active') {
      const startDate = new Date();
      const endDate = new Date();
      if (subscription.plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      subscription.status = 'active';
      subscription.paymentId = paymentId;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();

      await User.findByIdAndUpdate(subscription.user, {
        isPremium: true,
        subscriptionPlan: subscription.plan,
        subscriptionExpiry: endDate,
      });
    }

    // Show success page
    res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px">
<div style="text-align:center;background:#1A1A2E;border-radius:16px;padding:30px;max-width:400px;width:100%;border:1px solid #4CAF5040">
<div style="font-size:48px;margin-bottom:16px">🎉</div>
<h2 style="color:#4CAF50;margin:0 0 8px">Premium Activated!</h2>
<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px">Enjoy unlimited AI chat and all premium features. You can close this page and go back to the app.</p>
<div style="background:#4CAF5020;border-radius:12px;padding:16px;border:1px solid #4CAF5030">
<p style="color:#4CAF50;font-weight:bold;margin:0;font-size:16px">${subscription.plan === 'yearly' ? 'Yearly' : 'Monthly'} Plan Active</p>
</div>
</div>
</body></html>`);
  } catch (error) {
    console.error('Checkout callback error:', error);
    res.send(`<html><body style="background:#0D0D1A;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#FF6B6B">Something went wrong</h2><p style="color:#888">Please contact support.</p></div></body></html>`);
  }
};

// @desc    Get my subscription status
exports.getMySubscription = async (req, res, next) => {
  try {
    // Auto-expire check
    if (req.user.isPremium && req.user.subscriptionExpiry && new Date(req.user.subscriptionExpiry) < new Date()) {
      await User.findByIdAndUpdate(req.user.id, { isPremium: false, subscriptionPlan: 'free' });
      req.user.isPremium = false;
    }

    const subscription = await Subscription.findOne({ user: req.user.id, status: 'active' }).sort({ createdAt: -1 });
    const daysLeft = subscription ? Math.max(0, Math.ceil((subscription.endDate - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

    res.json({
      success: true,
      data: {
        isPremium: req.user.isPremium || false,
        plan: req.user.subscriptionPlan || 'free',
        daysLeft,
        expiry: req.user.subscriptionExpiry,
        subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel subscription
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user.id, status: 'active' });
    if (!subscription) return res.status(404).json({ success: false, message: 'No active subscription' });

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();

    res.json({ success: true, message: 'Subscription cancelled. Premium active until ' + subscription.endDate.toLocaleDateString('en-IN') });
  } catch (error) {
    next(error);
  }
};
