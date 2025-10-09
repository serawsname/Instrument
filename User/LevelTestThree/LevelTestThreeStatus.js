// File: LevelTestThree/LevelTestThreeStatus.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  // GET: ตรวจสอบสถานะการทำแบบทดสอบ leveltestthree
  router.get('/leveltestthree-status/:lessonId', authenticateToken, async (req, res) => {
    const { lessonId } = req.params;
    const userId = req.user.sub;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ lesson ID ที่ถูกต้อง' 
      });
    }

    try {
      // ดึง leveltestthree ตาม lesson_id
      const { data: levelTests, error: levelTestError } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name
        `)
        .eq('lesson_id', parseInt(lessonId))
        .order('leveltestthree_id')
        .limit(1);

      if (levelTestError) throw new Error(levelTestError.message);

      // ใช้ leveltestthree แรกที่พบสำหรับบทเรียนนี้
      const levelTest = levelTests[0];

      if (!levelTest) {
        return res.json({
          status: 'success',
          data: {
            hasLevelTest: false,
            message: 'ไม่พบแบบทดสอบสำหรับบทเรียนนี้'
          }
        });
      }

      // ตรวจสอบว่าผู้ใช้เคยทำแบบทดสอบนี้แล้วหรือไม่
      const { data: userUnlock, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', parseInt(userId))
        .eq('test_type', 'leveltestthree')
        .eq('test_id', levelTest.leveltestthree_id)
        .single();

      if (unlockError && unlockError.code !== 'PGRST116') {
        throw new Error(unlockError.message);
      }

      const hasEverPassed = !!userUnlock;

      if (hasEverPassed) {
        // ผู้ใช้เคยทำและผ่านแล้ว - สามารถเข้าเรียนได้เสมอ
        const options = [
          {
            id: 'retake',
            title: 'ทำแบบทดสอบใหม่',
            description: 'ทำแบบทดสอบอีกครั้งเพื่อปรับปรุงคะแนน',
            action: 'retake_test'
          },
          {
            id: 'learning',
            title: 'ไปเรียนรู้ออนไลน์',
            description: 'เข้าสู่ระบบการเรียนรู้ออนไลน์',
            action: 'go_to_learning'
          }
        ];

        res.json({
          status: 'success',
          data: {
            hasLevelTest: true,
            alreadyCompleted: true,
            levelTestId: levelTest.leveltestthree_id,
            levelTestName: levelTest.levelthree_name,
            passed: true,
            hasEverPassed: true, // เพิ่ม flag นี้เพื่อระบุว่าเคยผ่านแล้ว
            options: options
          }
        });
      } else {
        // ผู้ใช้ยังไม่เคยทำหรือยังไม่เคยผ่าน
        res.json({
          status: 'success',
          data: {
            hasLevelTest: true,
            alreadyCompleted: false,
            levelTestId: levelTest.leveltestthree_id,
            levelTestName: levelTest.levelthree_name,
            passed: false,
            hasEverPassed: false
          }
        });
      }

    } catch (error) {
      console.error('Error checking leveltestthree status:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });

  return router;
};
