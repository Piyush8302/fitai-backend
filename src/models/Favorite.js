const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, enum: ['workout', 'diet', 'article', 'exercise'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });

favoriteSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
