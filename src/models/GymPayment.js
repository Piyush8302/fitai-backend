const mongoose = require('mongoose');

// A payment the owner/staff marked (cash collected offline, recorded here).
const gymPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
  amount: { type: Number, required: true },
  plan: { type: String },
  // How the money came in. Older payments (before this field) have no value —
  // treated as cash, which is what the app supported at the time.
  method: { type: String, enum: ['cash', 'online'], default: 'cash' },
  paidDate: { type: Date, default: Date.now },
  periodMonths: { type: Number, default: 1 }, // how many months this covers
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('GymPayment', gymPaymentSchema);
