// خدمة إرسال رسائل SMS لأكواد التحقق (OTP)
// تدعم Twilio أو بوابة SMS محلية حسب SMS_PROVIDER في .env
const logger = require('../../config/logger');

async function sendOtpSms(phone, code) {
  const provider = process.env.SMS_PROVIDER || 'twilio';
  const message = `رمز التحقق الخاص بك في هاتف هو: ${code}\nصالح لمدة ${process.env.OTP_EXPIRES_MINUTES || 5} دقائق.`;

  if (provider === 'twilio') {
    return sendViaTwilio(phone, message);
  }
  return sendViaLocalGateway(phone, message);
}

async function sendViaTwilio(phone, message) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    const res = await client.messages.create({
      body: message,
      from: process.env.TWILIO_OTP_FROM_NUMBER,
      to: phone,
    });
    logger.info(`OTP SMS sent via Twilio: sid=${res.sid}`);
    return true;
  } catch (err) {
    logger.error('Twilio SMS error:', err.message);
    throw new Error('فشل إرسال رسالة التحقق');
  }
}

async function sendViaLocalGateway(phone, message) {
  const axios = require('axios');
  try {
    const res = await axios.get(process.env.SMS_GATEWAY_URL, {
      params: {
        userName: process.env.SMS_GATEWAY_USERNAME,
        apiKey: process.env.SMS_GATEWAY_API_KEY,
        numbers: phone.replace('+', ''),
        userSender: process.env.SMS_SENDER_NAME,
        msg: message,
      },
    });
    logger.info('OTP SMS sent via local gateway');
    return res.data;
  } catch (err) {
    logger.error('Local SMS gateway error:', err.message);
    throw new Error('فشل إرسال رسالة التحقق');
  }
}

module.exports = { sendOtpSms };
