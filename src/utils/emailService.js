// Email service using Brevo (Sendinblue) HTTP API
// Works on Render free tier (no SMTP needed)

const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.log(`Email not configured. Would send "${subject}" to ${to}`);
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'FitAI', email: process.env.EMAIL_USER || 'noreply@fitai.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Brevo email error:', JSON.stringify(data));
    throw new Error(data.message || 'Email send failed');
  }

  console.log(`Email sent to ${to}, messageId: ${data.messageId}`);
};

const otpTemplate = (title, description, otp) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0D0D1A;border-radius:12px;padding:32px;color:#fff">
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:48px">&#127947;</span>
      <h1 style="color:#6C63FF;margin:8px 0 0">FitAI</h1>
    </div>
    <h2 style="text-align:center;color:#fff;margin-bottom:8px">${title}</h2>
    <p style="text-align:center;color:#888;font-size:14px">${description}</p>
    <div style="background:#1A1A2E;border-radius:10px;padding:20px;text-align:center;margin:24px 0">
      <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6C63FF">${otp}</span>
    </div>
    <p style="text-align:center;color:#888;font-size:12px">If you didn't request this, please ignore this email.</p>
    <hr style="border:none;border-top:1px solid #333;margin:24px 0">
    <p style="text-align:center;color:#555;font-size:11px">FitAI - Your AI Fitness Companion</p>
  </div>
`;

exports.sendOtpEmail = async (email, otp) => {
  const html = otpTemplate(
    'Password Reset OTP',
    'Use the code below to reset your password. It expires in 10 minutes.',
    otp
  );
  await sendEmail(email, 'FitAI - Password Reset OTP', html);
};

exports.sendLoginOtpEmail = async (email, otp) => {
  const html = otpTemplate(
    'Login OTP',
    'Use the code below to login to your FitAI account. It expires in 10 minutes.',
    otp
  );
  await sendEmail(email, 'FitAI - Login OTP', html);
};

exports.sendOwnerApprovedEmail = async (email, name) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0D0D1A;border-radius:12px;padding:32px;color:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">&#127881;</span>
        <h1 style="color:#6C63FF;margin:8px 0 0">You're Approved!</h1>
      </div>
      <p style="color:#ccc;text-align:center;font-size:16px">Hi ${name || 'there'},</p>
      <p style="color:#888;text-align:center;font-size:14px;line-height:1.7">Your gym owner account on FitAI has been approved. &#127881;<br/><br/>
      Open the FitAI app, tap <b style="color:#fff">Login as Admin</b>, and enter your registered <b style="color:#fff">phone number or email</b>. A one-time OTP will be sent so you can log in &mdash; no password needed.</p>
      <hr style="border:none;border-top:1px solid #333;margin:24px 0">
      <p style="text-align:center;color:#555;font-size:11px">FitAI - Your AI Fitness Companion</p>
    </div>
  `;
  await sendEmail(email, 'FitAI - Your gym is approved! 🎉', html);
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
