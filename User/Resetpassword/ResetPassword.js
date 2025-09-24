const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

module.exports = (supabase) => {
  router.post('/reset-password', async (req, res) => {
    const email = req.body.email?.trim();
    const newPassword = req.body.new_password?.trim();

    if (!email || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('user')
        .select('email')
        .eq('email', email);

      if (fetchError) {
        return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการค้นหาผู้ใช้งาน' });
      }

      if (!data || data.length === 0) {
        return res.status(400).json({ status: 'error', message: 'ไม่พบผู้ใช้งานที่อีเมลนี้' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabase
        .from('user')
        .update({ password: hashedPassword })
        .eq('email', email);

      if (updateError) {
        return res.status(500).json({ status: 'error', message: 'อัปเดตรหัสผ่านไม่สำเร็จ' });
      }

      return res.json({ status: 'success', message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' });
    }
  });

  return router;
};
