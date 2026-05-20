// SMS OTP service using Fast2SMS (free tier for Indian numbers)
// Sign up at https://www.fast2sms.com to get your API key
// Set FAST2SMS_API_KEY in your environment variables

exports.sendOtpSms = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.log(`📱 SMS service not configured. OTP for ${phone}: ${otp}`);
    return { success: true, fallback: true };
  }

  // Remove +91 or 91 prefix if present
  const cleanPhone = phone.replace(/^\+?91/, '').trim();

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: `Your FitAI OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        flash: 0,
        numbers: cleanPhone,
      }),
    });

    const data = await response.json();
    console.log('Fast2SMS response:', JSON.stringify(data));

    if (data.return) {
      console.log(`✅ OTP sent to ${cleanPhone}`);
      return { success: true };
    } else {
      console.error('Fast2SMS error:', data.message);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('SMS send error:', error.message);
    return { success: false, error: error.message };
  }
};
