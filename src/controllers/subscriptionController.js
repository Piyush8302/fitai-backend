const Subscription = require('../models/Subscription');
const User = require('../models/User');

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
          'Unlimited AI Diet Plans',
          'Personalized Workout Plans',
          'AI Health Coach Chat',
          'Advanced Analytics',
          'Premium Exercises Library',
          'No Ads',
          'Priority Support',
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
          'Everything in Monthly +',
          'Yearly Progress Reports',
          'Exclusive Workout Challenges',
          'Dietitian Tips',
          'Early Access to Features',
        ],
      },
    ];

    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
};

// @desc    Create subscription order
exports.createOrder = async (req, res, next) => {
  try {
    const { plan } = req.body; // 'monthly' or 'yearly'
    const amount = plan === 'yearly' ? 24900 : 2900; // paisa

    // TODO: Create Razorpay order here
    // const razorpay = new Razorpay({ key_id, key_secret });
    // const order = await razorpay.orders.create({ amount, currency: 'INR' });

    const subscription = await Subscription.create({
      user: req.user.id,
      plan,
      amount,
      status: 'pending',
      orderId: 'order_' + Date.now(), // Replace with Razorpay order ID
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        orderId: subscription.orderId,
        amount: amount / 100,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment & activate subscription
exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    // TODO: Verify Razorpay signature
    // const isValid = validateWebhookSignature(orderId + '|' + paymentId, signature, key_secret);

    const subscription = await Subscription.findOne({ orderId });
    if (!subscription) return res.status(404).json({ success: false, message: 'Order not found' });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (subscription.plan === 'yearly' ? 12 : 1));

    subscription.status = 'active';
    subscription.paymentId = paymentId;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    await subscription.save();

    // Update user
    await User.findByIdAndUpdate(subscription.user, {
      isPremium: true,
      subscriptionPlan: subscription.plan,
      subscriptionExpiry: endDate,
    });

    res.json({ success: true, message: 'Subscription activated!', data: subscription });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my subscription
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user.id, status: 'active' }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: {
        isPremium: req.user.isPremium,
        subscription,
        daysLeft: subscription ? Math.max(0, Math.ceil((subscription.endDate - Date.now()) / (1000 * 60 * 60 * 24))) : 0,
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

    // Keep premium until expiry
    res.json({ success: true, message: 'Subscription cancelled. Premium active until ' + subscription.endDate.toLocaleDateString() });
  } catch (error) {
    next(error);
  }
};
