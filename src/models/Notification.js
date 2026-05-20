const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, enum: ['reminder', 'achievement', 'tip', 'update', 'streak', 'promo', 'info', 'alert', 'success', 'warning'], default: 'tip' },
  isRead: { type: Boolean, default: false },
  data: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
