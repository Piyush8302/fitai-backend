const User = require('../models/User');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/emailService');
const { sendOtpSms } = require('../utils/smsService');

// @desc    Register user
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, phone });
    const token = user.getSignedToken();

    sendWelcomeEmail(email, name).catch(err => console.error('Welcome email failed:', err.message));

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

// @desc    Send OTP (phone or email)
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, email } = req.body;
    if (!phone && !email) return res.status(400).json({ success: false, message: 'Provide phone or email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    let user;
    if (email) {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, name: 'User', authProvider: 'otp' });
      }
    } else {
      user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({ phone, name: 'User', email: `${phone}@fitai.temp`, authProvider: 'otp' });
      }
    }

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    if (email) {
      try {
        await sendOtpEmail(email, otp);
      } catch (emailErr) {
        console.error('Email OTP send failed:', emailErr.message);
        return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
      }
      res.json({ success: true, message: 'OTP sent to email' });
    } else {
      await sendOtpSms(phone, otp);
      res.json({ success: true, message: 'OTP sent successfully', otp: process.env.NODE_ENV === 'development' ? otp : undefined });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP (phone or email)
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, email, otp } = req.body;
    if (!phone && !email) return res.status(400).json({ success: false, message: 'Provide phone or email' });

    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+otp +otpExpiry');
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = user.getSignedToken();
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, isProfileComplete: user.isProfileComplete } });
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

  // Store the app's redirect URL in the state parameter so the callback knows where to send the user
  const appRedirect = req.query.redirect || 'fitai://auth';
  const state = Buffer.from(JSON.stringify({ redirect: appRedirect })).toString('base64');

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    '&response_type=code' +
    `&scope=${encodeURIComponent('profile email')}` +
    '&access_type=offline' +
    '&prompt=consent' +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
};

// Helper to send an HTML page that redirects to the app's custom scheme
const sendAppRedirect = (res, deepLink) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FitAI Login</title></head><body style="background:#0D0D1A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#fff;text-align:center"><div><p style="font-size:18px">Redirecting to FitAI...</p><p style="font-size:14px;color:#888">If the app doesn't open, <a href="${deepLink}" style="color:#6C63FF">tap here</a></p></div><script>window.location.href="${deepLink}";</script></body></html>`);
};

// @desc    Google OAuth callback (handles code exchange and redirects to app)
exports.googleCallback = async (req, res) => {
  // Parse the app redirect URL from state
  let appRedirect = 'fitai://auth';
  try {
    if (req.query.state) {
      const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
      if (stateData.redirect) appRedirect = stateData.redirect;
    }
  } catch (e) { /* use default */ }

  // Build redirect helper with the correct app URL
  const buildRedirect = (params) => {
    const separator = appRedirect.includes('?') ? '&' : '?';
    return `${appRedirect}${separator}${params}`;
  };

  try {
    const { code } = req.query;
    if (!code) return sendAppRedirect(res, buildRedirect('error=no_code'));

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '501212222055-10earp0vg4ecv3k7427kkg67soooqd3m.apps.googleusercontent.com';
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_SECRET) {
      console.error('GOOGLE_CLIENT_SECRET is not set');
      return sendAppRedirect(res, buildRedirect('error=server_config'));
    }

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
      console.error('Google token exchange failed:', tokenData);
      return sendAppRedirect(res, buildRedirect('error=token_failed'));
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

    sendAppRedirect(res, buildRedirect(`token=${jwtToken}&user=${userData}`));
  } catch (error) {
    console.error('Google callback error:', error);
    sendAppRedirect(res, buildRedirect('error=server_error'));
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

    try {
      await sendOtpEmail(email, otp);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
    }

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
