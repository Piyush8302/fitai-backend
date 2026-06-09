const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['monthly', 'yearly'], required: true },
  amount: { type: Number, required: true }, // in paisa (2900 = ₹29)
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'active', 'expired', 'cancelled', 'rejected'], default: 'pending' },

  // Payment method
  paymentMethod: { type: String, enum: ['razorpay', 'upi'], default: 'upi' },

  // Razorpay fields
  paymentId: { type: String },
  orderId: { type: String },

  // UPI fields
  utrNumber: { type: String }, // UTR / Transaction Reference
  upiTransactionId: { type: String },
  upiApp: { type: String }, // googlepay, phonepe, paytm etc

  // Dates
  startDate: { type: Date },
  endDate: { type: Date },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  autoRenew: { type: Boolean, default: false },
  adminNote: { type: String },
}, { timestamps: true });

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
