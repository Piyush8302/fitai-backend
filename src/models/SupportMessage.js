const mongoose = require('mongoose');

// A "Contact Us" message from a gym owner / staff / user — shown to the
// super-admin in the admin panel so they can reach out.
const supportMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  role: { type: String, default: 'user' },     // user | gym_owner | gym_staff
  gymName: { type: String, trim: true },        // for gym owners/staff
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

supportMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
