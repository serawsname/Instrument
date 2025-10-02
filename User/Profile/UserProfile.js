const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // ฟังก์ชันคำนวณ level ของผู้ใช้จากคะแนนรวม
  const calculateUserLevel = async (userId) => {
    try {
      // ดึงคะแนนรวมทั้งหมดของผู้ใช้จาก posttest_score
      const { data: scores, error: scoreError } = await supabase
        .from('posttest_score')
        .select('score')
        .eq('user_id', userId);

      if (scoreError) {
        console.error('Error fetching user scores:', scoreError);
        return null;
      }

      // คำนวณคะแนนรวมทั้งหมด
      const totalScore = scores.reduce((sum, record) => sum + record.score, 0);

      // ดึงข้อมูล level ทั้งหมดเรียงตามคะแนนจากน้อยไปมาก
      const { data: levels, error: levelError } = await supabase
        .from('user_level')
        .select('level_id, level_name, score')
        .order('score', { ascending: true });

      if (levelError) {
        console.error('Error fetching user levels:', levelError);
        return null;
      }

      // หา level ที่เหมาะสมกับคะแนนของผู้ใช้
      // ผู้ใช้จะได้ level สูงสุดที่มีคะแนนต่ำกว่าหรือเท่ากับคะแนนรวมของผู้ใช้
      let userLevel = null;
      for (const level of levels) {
        if (totalScore >= level.score) {
          userLevel = level;
        } else {
          break;
        }
      }

      return {
        total_score: totalScore,
        level: userLevel,
        all_levels: levels
      };

    } catch (error) {
      console.error('Error calculating user level:', error);
      return null;
    }
  };

  router.get('/user', async (req, res) => {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาระบุชื่อผู้ใช้',
      });
    }

    try {
      // ดึงข้อมูลผู้ใช้พื้นฐาน
      const { data, error } = await supabase
        .from('user')
        .select('user_id, username, phone, email, age')
        .eq('username', username)
        .maybeSingle(); // ใช้ maybeSingle() แทน single() เพื่อให้ return null เมื่อไม่พบข้อมูล

      if (error) {
        console.error('User profile error:', error);
        return res.status(500).json({
          status: 'error',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้',
        });
      }

      if (!data) {
        return res.status(404).json({
          status: 'error',
          message: 'ไม่พบผู้ใช้',
        });
      }

      // คำนวณ level ของผู้ใช้
      const levelInfo = await calculateUserLevel(data.user_id);

      // เตรียมข้อมูลส่งกลับ
      const userProfile = {
        user_id: data.user_id,
        username: data.username,
        phone: data.phone,
        email: data.email,
        age: data.age,
        total_score: levelInfo ? levelInfo.total_score : 0,
        current_level: levelInfo && levelInfo.level ? {
          level_id: levelInfo.level.level_id,
          level_name: levelInfo.level.level_name,
          required_score: levelInfo.level.score
        } : null
      };

      return res.json({
        status: 'success',
        user: userProfile,
        level_info: levelInfo ? {
          total_score: levelInfo.total_score,
          current_level: levelInfo.level,
          available_levels: levelInfo.all_levels
        } : null
      });

    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err);
      return res.status(500).json({
        status: 'error',
        message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
      });
    }
  });

  return router;
};
