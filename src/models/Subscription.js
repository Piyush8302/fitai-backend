const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['monthly', 'yearly'], required: true },
  amount: { type: Number, required: true }, // in paisa (2900 = ₹29)
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'active', 'expired', 'cancelled'], default: 'pending' },
  paymentId: { type: String }, // Razorpay payment ID
  orderId: { type: String }, // Razorpay order ID
  startDate: { type: Date },
  endDate: { type: Date },
  autoRenew: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
