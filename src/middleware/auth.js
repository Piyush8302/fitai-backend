const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Admin only
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
};

// Gym owner (or super admin) only — blocks gym_staff from owner-only actions
exports.ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'gym_staff') {
    return res.status(403).json({ success: false, message: 'Only the gym owner can do this' });
  }
  next();
};

// Premium only
exports.premium = (req, res, next) => {
  if (req.user && (req.user.isPremium || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Premium subscription required' });
  }
};
