const express = require('express');
const otpStore = require('./OtpStore');

module.exports = () => {
  const router = express.Router();

  router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const record = otpStore[email];
    if (!record) {
      return res.status(400).json({ status: 'error', message: 'ไม่พบ OTP สำหรับอีเมลนี้' });
    }

    if (Date.now() > record.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ status: 'error', message: 'OTP หมดอายุแล้ว' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ status: 'error', message: 'OTP ไม่ถูกต้อง' });
    }

    delete otpStore[email];

    return res.json({ status: 'success', message: 'OTP ถูกต้อง' });
  });

  return router;
};
