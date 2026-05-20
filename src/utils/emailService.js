const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`Email not configured. Would send "${subject}" to ${to}`);
    return;
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    console.log('SMTP connection verified');
  } catch (verifyErr) {
    console.error('SMTP verify failed:', verifyErr.message);
    throw verifyErr;
  }

  const mailOptions = {
    from: `"FitAI" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${to}, messageId: ${info.messageId}`);
};

exports.sendOtpEmail = async (email, otp) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0D0D1A;border-radius:12px;padding:32px;color:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">&#127947;</span>
        <h1 style="color:#6C63FF;margin:8px 0 0">FitAI</h1>
      </div>
      <h2 style="text-align:center;color:#fff;margin-bottom:8px">Password Reset OTP</h2>
      <p style="text-align:center;color:#888;font-size:14px">Use the code below to reset your password. It expires in 10 minutes.</p>
      <div style="background:#1A1A2E;border-radius:10px;padding:20px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6C63FF">${otp}</span>
      </div>
      <p style="text-align:center;color:#888;font-size:12px">If you didn't request this, please ignore this email.</p>
      <hr style="border:none;border-top:1px solid #333;margin:24px 0">
      <p style="text-align:center;color:#555;font-size:11px">FitAI - Your AI Fitness Companion</p>
    </div>
  `;

  await sendEmail(email, 'FitAI - Password Reset OTP', html);
};

exports.sendWelcomeEmail = async (email, name) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0D0D1A;border-radius:12px;padding:32px;color:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">&#127947;</span>
        <h1 style="color:#6C63FF;margin:8px 0 0">Welcome to FitAI!</h1>
      </div>
      <p style="color:#ccc;text-align:center;font-size:16px">Hi ${name},</p>
      <p style="color:#888;text-align:center;font-size:14px">Your account has been created successfully. Start your fitness journey with personalized AI-powered workout plans, diet charts, and more!</p>
      <hr style="border:none;border-top:1px solid #333;margin:24px 0">
      <p style="text-align:center;color:#555;font-size:11px">FitAI - Your AI Fitness Companion</p>
    </div>
  `;

  await sendEmail(email, 'Welcome to FitAI!', html);
};
