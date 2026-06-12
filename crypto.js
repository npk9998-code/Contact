// تشفير/فك تشفير القيم الحساسة (مفاتيح Twilio/WhatsApp) قبل حفظها في قاعدة البيانات
const CryptoJS = require('crypto-js');

const KEY = process.env.ENCRYPTION_KEY;

function encrypt(plainText) {
  if (!plainText) return null;
  if (!KEY) throw new Error('ENCRYPTION_KEY غير موجود في البيئة');
  return CryptoJS.AES.encrypt(plainText, KEY).toString();
}

function decrypt(cipherText) {
  if (!cipherText) return null;
  if (!KEY) throw new Error('ENCRYPTION_KEY غير موجود في البيئة');
  const bytes = CryptoJS.AES.decrypt(cipherText, KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };
