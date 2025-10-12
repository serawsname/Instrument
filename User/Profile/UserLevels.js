const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // API สำหรับดึงข้อมูลระดับผู้ใช้ทั้งหมด
  router.get('/user-levels', async (req, res) => {
    try {
      // ดึงข้อมูล level ทั้งหมดเรียงตามคะแนนจากน้อยไปมาก
      const { data: levels, error } = await supabase
        .from('user_level')
        .select('level_id, level_name, score')
        .order('score', { ascending: true });

      if (error) {
        console.error('Error fetching user levels:', error);
        return res.status(500).json({
          status: 'error',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลระดับผู้ใช้'
        });
      }

      return res.json({
        status: 'success',
        data: levels
      });

    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูลระดับผู้ใช้:', err);
      return res.status(500).json({
        status: 'error',
        message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
      });
    }
  });

  return router;
};