const mongoose = require('mongoose');

// A payment the owner/staff marked (cash collected offline, recorded here).
const gymPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
  amount: { type: Number, required: true },
  plan: { type: String },
  paidDate: { type: Date, default: Date.now },
  periodMonths: { type: Number, default: 1 }, // how many months this covers
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('GymPayment', gymPaymentSchema);
