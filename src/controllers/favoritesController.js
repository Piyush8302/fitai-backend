const Favorite = require('../models/Favorite');

// @desc    Add to favorites
exports.addFavorite = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.body;
    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'Provide itemType and itemId' });
    }

    const exists = await Favorite.findOne({ user: req.user.id, itemType, itemId });
    if (exists) return res.status(400).json({ success: false, message: 'Already in favorites' });

    const favorite = await Favorite.create({ user: req.user.id, itemType, itemId });
    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove from favorites
exports.removeFavorite = async (req, res, next) => {
  try {
    const fav = await Favorite.findOneAndDelete({ user: req.user.id, _id: req.params.id });
    if (!fav) return res.status(404).json({ success: false, message: 'Favorite not found' });
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user favorites (optionally filter by type)
exports.getFavorites = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.type) filter.itemType = req.query.type;

    const favorites = await Favorite.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: favorites.length, data: favorites });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if item is favorited
exports.checkFavorite = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.query;
    const exists = await Favorite.findOne({ user: req.user.id, itemType, itemId });
    res.json({ success: true, isFavorited: !!exists, data: exists });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle favorite (add if missing, remove if exists)
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.body;
    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'Provide itemType and itemId' });
    }

    const exists = await Favorite.findOne({ user: req.user.id, itemType, itemId });
    if (exists) {
      await Favorite.findByIdAndDelete(exists._id);
      return res.json({ success: true, isFavorited: false, message: 'Removed from favorites' });
    }

    const favorite = await Favorite.create({ user: req.user.id, itemType, itemId });
    res.status(201).json({ success: true, isFavorited: true, data: favorite });
  } catch (error) {
    next(error);
  }
};
