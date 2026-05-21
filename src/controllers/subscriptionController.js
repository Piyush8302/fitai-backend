const Subscription = require('../models/Subscription');
const User = require('../models/User');
const crypto = require('crypto');

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

// @desc    Get subscription plans
exports.getPlans = async (req, res, next) => {
  try {
    const plans = [
      {
        id: 'monthly',
        name: 'Premium Monthly',
        price: 29,
        currency: 'INR',
        duration: '1 Month',
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
        price: 249,
        originalPrice: 348,
        currency: 'INR',
        duration: '1 Year',
        savings: '28% OFF',
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

// @desc    Checkout page (HTML with Razorpay embedded) - for Expo WebBrowser
exports.checkoutPage = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await Subscription.findById(subscriptionId).populate('user', 'name email phone');
    if (!subscription) return res.status(404).send('Order not found');
    if (subscription.status === 'active') return res.send('<h2>Already activated!</h2><script>window.location="fitai://premium-success";</script>');

    const key = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const amount = subscription.amount;
    const user = subscription.user;
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const verifyUrl = `${protocol}://${req.get('host')}/api/subscription/checkout-verify`;

    const safeName = (user.name || '').replace(/['"\\]/g, '');
    const safeEmail = (user.email || '').replace(/['"\\]/g, '');
    const safePhone = (user.phone || '').replace(/['"\\]/g, '');
    const planLabel = subscription.plan === 'yearly' ? 'Yearly' : 'Monthly';
    const priceDisplay = amount / 100;

    const html = '<!DOCTYPE html>' +
    '<html><head>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>FitAI Premium</title>' +
    '<style>' +
    'body{font-family:system-ui;background:#0D0D1A;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}' +
    '.card{background:#1A1A2E;border-radius:16px;padding:30px;max-width:400px;width:100%;text-align:center;border:1px solid #6C63FF30}' +
    'h1{color:#6C63FF;font-size:24px;margin-bottom:4px}' +
    '.status{color:#6C63FF;font-size:16px;margin:20px 0}' +
    '.error{color:#FF6B6B;font-size:14px;margin:16px 0}' +
    'button{background:linear-gradient(135deg,#6C63FF,#4834DF);color:#fff;border:none;padding:16px 40px;border-radius:12px;font-size:18px;font-weight:bold;cursor:pointer;width:100%;margin-top:10px}' +
    '.success{background:#4CAF50;color:#fff;font-size:18px;font-weight:bold;padding:20px;border-radius:12px;margin:20px 0}' +
    '.secure{color:#666;font-size:12px;margin-top:16px}' +
    '</style>' +
    '<script src="https://checkout.razorpay.com/v1/checkout.js"></script>' +
    '</head><body>' +
    '<div class="card">' +
    '<h1>FitAI Premium</h1>' +
    '<div class="status" id="status">Opening payment form...</div>' +
    '<div id="errorBox"></div>' +
    '<button id="payBtn" onclick="startPayment()" style="display:none">Retry Payment</button>' +
    '<div class="secure">Secured by Razorpay</div>' +
    '</div>' +
    '<script>' +
    'var payConfig={' +
    'key:"' + key + '",' +
    'amount:' + amount + ',' +
    'currency:"INR",' +
    'name:"FitAI Premium",' +
    'description:"' + planLabel + ' Subscription",' +
    'order_id:"' + subscription.orderId + '",' +
    'prefill:{name:"' + safeName + '",email:"' + safeEmail + '",contact:"' + safePhone + '"},' +
    'theme:{color:"#6C63FF"},' +
    'handler:function(r){' +
    'document.getElementById("status").textContent="Activating premium...";' +
    'fetch("' + verifyUrl + '",{' +
    'method:"POST",' +
    'headers:{"Content-Type":"application/json"},' +
    'body:JSON.stringify({orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature,subscriptionId:"' + subscriptionId + '"})' +
    '}).then(function(x){return x.json()}).then(function(d){' +
    'if(d.success){document.getElementById("status").innerHTML="<div class=success>Premium Activated! Close this page.</div>";}' +
    'else{document.getElementById("status").textContent="Failed: "+(d.message||"Error");document.getElementById("payBtn").style.display="block";}' +
    '}).catch(function(){document.getElementById("status").textContent="Network error";document.getElementById("payBtn").style.display="block";});' +
    '},' +
    'modal:{ondismiss:function(){document.getElementById("status").textContent="Payment cancelled";document.getElementById("payBtn").style.display="block";}}' +
    '};' +
    'function startPayment(){' +
    'document.getElementById("status").textContent="Opening payment...";' +
    'document.getElementById("payBtn").style.display="none";' +
    'document.getElementById("errorBox").innerHTML="";' +
    'try{' +
    'if(typeof Razorpay==="undefined"){document.getElementById("errorBox").innerHTML="<div class=error>Payment SDK not loaded. Check internet.</div>";document.getElementById("payBtn").style.display="block";return;}' +
    'var rzp=new Razorpay(payConfig);' +
    'rzp.on("payment.failed",function(resp){document.getElementById("errorBox").innerHTML="<div class=error>"+resp.error.description+"</div>";document.getElementById("payBtn").style.display="block";});' +
    'rzp.open();' +
    '}catch(e){document.getElementById("errorBox").innerHTML="<div class=error>"+e.message+"</div>";document.getElementById("payBtn").style.display="block";}' +
    '}' +
    'window.onload=function(){setTimeout(startPayment,500);};' +
    '</script>' +
    '</body></html>';

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

// @desc    Checkout verify (called from checkout HTML page)
exports.checkoutVerify = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, subscriptionId } = req.body;

    // Verify signature
    if (process.env.RAZORPAY_KEY_SECRET && signature) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      if (expectedSig !== signature) {
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });
    if (subscription.status === 'active') return res.json({ success: true, message: 'Already active' });

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

    res.json({ success: true, message: 'Premium activated!' });
  } catch (error) {
    next(error);
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
