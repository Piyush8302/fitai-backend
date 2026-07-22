const mongoose = require('mongoose');

// Simple income/expense ledger per gym (owner's cashbook)
const gymCashbookSchema = new mongoose.Schema({
  gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, trim: true },
  date: { type: Date, default: Date.now },
  // 'manual' = owner added | 'membership' = auto from a member payment
  source: { type: String, enum: ['manual', 'membership'], default: 'manual' },
  // Cash vs online — carried over from the payment, or picked on a manual entry.
  method: { type: String, enum: ['cash', 'online'], default: 'cash' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'GymPayment' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

gymCashbookSchema.index({ gym: 1, date: -1 });

module.exports = mongoose.model('GymCashbook', gymCashbookSchema);
