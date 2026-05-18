const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['diet', 'workout', 'health', 'general'], default: 'general' },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
