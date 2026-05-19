const User = require('../models/User');

// @desc    Register user
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, phone });
    const token = user.getSignedToken();

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = user.getSignedToken();

    res.json({
      success: true,
      token,
      user: {
        id: user._id, name: user.name, email: user.email,
        isProfileComplete: user.isProfileComplete, isPremium: user.isPremium,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, name: 'User', email: `${phone}@fitai.temp`, authProvider: 'otp' });
    }

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // TODO: Send OTP via SMS service
    console.log(`📱 OTP for ${phone}: ${otp}`);

    res.json({ success: true, message: 'OTP sent successfully', otp: process.env.NODE_ENV === 'development' ? otp : undefined });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone }).select('+otp +otpExpiry');
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = user.getSignedToken();
    res.json({ success: true, token, user: { id: user._id, name: user.name, phone: user.phone, isProfileComplete: user.isProfileComplete } });
  } catch (error) {
    next(error);
  }
};

// @desc    Google login (API - receives user info from frontend)
exports.googleLogin = async (req, res, next) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, name, avatar, authProvider: 'google' });
    }

    const token = user.getSignedToken();
    res.json({
      success: true, token,
      user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete, isPremium: user.isPremium },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth redirect (for mobile app)
exports.googleMobileAuth = (req, res) => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '501212222055-10earp0vg4ecv3k7427kkg67soooqd3m.apps.googleusercontent.com';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const callbackUrl = `${protocol}://${req.get('host')}/api/auth/google/callback`;

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    '&response_type=code' +
    `&scope=${encodeURIComponent('profile email')}` +
    '&access_type=offline' +
    '&prompt=consent';

  res.redirect(authUrl);
};

// @desc    Google OAuth callback (handles code exchange and redirects to app)
exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code received');

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '501212222055-10earp0vg4ecv3k7427kkg67soooqd3m.apps.googleusercontent.com';
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const callbackUrl = `${protocol}://${req.get('host')}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.redirect('fitai://auth?error=token_failed');
    }

    const userRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    let user = await User.findOne({ email: googleUser.email });
    if (!user) {
      user = await User.create({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        authProvider: 'google',
      });
    }

    const jwtToken = user.getSignedToken();
    const userData = encodeURIComponent(JSON.stringify({
      id: user._id, name: user.name, email: user.email,
      isProfileComplete: user.isProfileComplete, isPremium: user.isPremium,
    }));

    res.redirect(`fitai://auth?token=${jwtToken}&user=${userData}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('fitai://auth?error=server_error');
  }
};

// @desc    Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Provide current and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Account uses social login, cannot change password' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    const token = user.getSignedToken();
    res.json({ success: true, message: 'Password changed successfully', token });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - send reset OTP
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Provide email' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'No account with that email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // TODO: Send OTP via email service
    console.log(`📧 Password reset OTP for ${email}: ${otp}`);

    res.json({ success: true, message: 'Reset OTP sent to email', otp: process.env.NODE_ENV === 'development' ? otp : undefined });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with OTP
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Provide email, OTP, and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = user.getSignedToken();
    res.json({ success: true, message: 'Password reset successful', token });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete account
exports.deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isActive: false });
    res.json({ success: true, message: 'Account deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const fields = ['name', 'age', 'gender', 'height', 'weight', 'targetWeight', 'activityLevel', 'fitnessGoal', 'dietPreference', 'avatar'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // Mark profile complete if essentials provided
    if (req.body.age && req.body.gender && req.body.height && req.body.weight && req.body.fitnessGoal) {
      updates.isProfileComplete = true;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed admin user
exports.seedAdmin = async (req, res, next) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.json({ success: true, message: 'Admin already exists', email: adminExists.email });
    }

    const admin = await User.create({
      name: 'FitAI Admin',
      email: 'admin@fitai.com',
      password: 'admin123',
      role: 'admin',
      isActive: true,
      isPremium: true,
      isProfileComplete: true,
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created',
      credentials: { email: 'admin@fitai.com', password: 'admin123' },
    });
  } catch (error) {
    next(error);
  }
};
