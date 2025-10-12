// File: Resetpassword/CheckEmail.js
module.exports = (supabase) => {
  const express = require('express');
  const router = express.Router();

  // ✅ จุดตรวจสอบที่ 1: path ต้องเป็น '/check-email'
  router.post('/check-email', async (req, res) => { 
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'กรุณาใส่อีเมล' });
    }

    try {
      const { data, error } = await supabase
        .from('user')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase error:', error);
        return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการตรวจสอบอีเมล' });
      }

      if (data) {
        return res.status(200).json({ status: 'success', message: 'อีเมลมีในระบบ' });
      } else {
        return res.status(404).json({ status: 'error', message: 'ไม่พบอีเมลนี้ในระบบ' });
      }
    } catch (err) {
      console.error('❌ Server error:', err.message);
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' });
    }
  });

  return router;
};