const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = (supabase) => {
  router.put('/update-profile', async (req, res) => {
    const { password, email, phone, age, username } = req.body;

    if (!password || !email || !phone || !age || !username) {
      return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบ' });
    }

    try {
      const { data: user, error: selectError } = await supabase
        .from('user')
        .select('password')
        .eq('username', username)
        .maybeSingle(); // ใช้ maybeSingle() แทน single() เพื่อให้ return null เมื่อไม่พบข้อมูล

      if (selectError) {
        console.error('Update profile select error:', selectError);
        return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
      }

      if (!user) {
        return res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้งาน' });
      }

      const samePassword = await bcrypt.compare(password, user.password);
      if (samePassword) {
        return res.status(400).json({
          status: 'error',
          message: 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { error: updateError } = await supabase
        .from('user')
        .update({
          password: hashedPassword,
          email,
          phone,
          age,
        })
        .eq('username', username);

      if (updateError) {
        return res.status(500).json({ status: 'error', message: 'ไม่สามารถอัปเดตข้อมูลได้' });
      }

      return res.json({ status: 'success' });
    } catch (err) {
      console.error('Update error:', err);
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
  });

  return router;
};
