const express = require('express');
const bcrypt = require('bcrypt');

module.exports = (supabase) => {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { username, password, phone, email, age } = req.body;

    // ✅ ตรวจสอบข้อมูลที่ต้องมีให้ครบ
    if (!username || !password || !phone || !email || age === undefined) {
      return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบ' });
    }

    // ✅ ตรวจสอบช่วงอายุ
    if (typeof age !== 'number' || age < 18 || age > 30) {
      return res.status(400).json({ status: 'error', message: 'อายุต้องอยู่ในช่วง 18 ถึง 30 ปี' });
    }

    // ✅ ห้ามมีภาษาไทยใน username หรือ email
    if (/[\u0E00-\u0E7F]/.test(username) || /[\u0E00-\u0E7F]/.test(email)) {
      return res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้และอีเมลไม่ควรมีตัวอักษรภาษาไทย' });
    }

    // ✅ ตรวจสอบเบอร์โทร
    if (!/^(0[689]\d{8}|\+66[689]\d{8})$/.test(phone)) {
      return res.status(400).json({ status: 'error', message: 'เบอร์โทรไม่ถูกต้อง' });
    }

    // ✅ ตรวจสอบรูปแบบรหัสผ่าน
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
      return res.status(400).json({
        status: 'error',
        message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว และประกอบด้วยตัวอักษร A-Z และตัวเลข'
      });
    }

    // ✅ ตรวจสอบอีเมล
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ status: 'error', message: 'อีเมลไม่ถูกต้อง' });
    }

    try {
      // ✅ ตรวจสอบว่าชื่อผู้ใช้มีอยู่แล้วหรือไม่
      const { data: existingUser, error: checkError } = await supabase
        .from('user')
        .select('user_id')
        .eq('username', username)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Check user error:', checkError.message);
        return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการตรวจสอบผู้ใช้' });
      }

      if (existingUser) {
        return res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
      }

      // ✅ เข้ารหัสรหัสผ่าน
      const hashedPassword = await bcrypt.hash(password, 10);

      // ✅ แทรกข้อมูลผู้ใช้ใหม่
      const { error: insertError } = await supabase
        .from('user')
        .insert([{ username, password: hashedPassword, phone, email, age, role: 'user' }]);

      if (insertError) {
        console.error("Insert error:", insertError.message);
        return res.status(500).json({ status: 'error', message: 'ลงทะเบียนไม่สำเร็จ' });
      }

      return res.json({ status: 'success', message: 'ลงทะเบียนสำเร็จ' });

    } catch (err) {
      console.error('Unexpected error:', err);
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดบางอย่าง', detail: err.message });
    }
  });

  return router;
};
