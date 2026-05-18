const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['nutrition', 'workout', 'wellness', 'weight_loss', 'weight_gain', 'yoga', 'mental_health', 'indian_diet', 'international_diet', 'supplements', 'disease_prevention', 'home_remedies'],
    required: true,
  },
  tags: [String],
  image: { type: String, default: '' },
  source: { type: String, enum: ['indian', 'international', 'fitai'], default: 'fitai' },
  author: { type: String, default: 'FitAI Health Team' },
  readTime: { type: Number, default: 5 },
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  isPremium: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

articleSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

articleSchema.index({ category: 1, source: 1, isPublished: 1 });
articleSchema.index({ tags: 1 });

module.exports = mongoose.model('Article', articleSchema);
