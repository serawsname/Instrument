const express = require('express');

module.exports = function(supabase) {
  const router = express.Router();

  // ตรวจสอบว่าผู้ใช้ผ่านแบบทดสอบระดับปานกลางหรือไม่
  router.get('/user-unlock/check/:userId/:testType/:testId', async (req, res) => {
    try {
      const { userId, testType, testId } = req.params;

      // ตรวจสอบในตาราง user_unlock
      const { data: unlockData, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', parseInt(userId))
        .eq('test_type', testType)
        .eq('test_id', parseInt(testId));

      if (unlockError) {
        console.error('Error checking user unlock:', unlockError);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์',
          error: unlockError.message
        });
      }

      // ถ้ามีข้อมูลใน user_unlock แสดงว่าผ่านแล้ว
      const isUnlocked = unlockData && unlockData.length > 0;

      res.json({
        success: true,
        isUnlocked: isUnlocked,
        message: isUnlocked ? 'ผู้ใช้ผ่านแบบทดสอบแล้ว' : 'ผู้ใช้ยังไม่ผ่านแบบทดสอบ'
      });

    } catch (error) {
      console.error('Error in user unlock check:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  // ตรวจสอบว่าผู้ใช้ผ่านแบบทดสอบระดับปานกลาง (leveltesttwo) หรือไม่
  router.get('/user-unlock/check-leveltesttwo/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // ตรวจสอบในตาราง user_unlock ว่าผู้ใช้ผ่าน leveltesttwo หรือไม่
      const { data: unlockData, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', parseInt(userId))
        .eq('test_type', 'leveltesttwo');

      if (unlockError) {
        console.error('Error checking leveltesttwo unlock:', unlockError);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์',
          error: unlockError.message
        });
      }

      // ถ้ามีข้อมูลใน user_unlock แสดงว่าผ่านแล้ว
      const hasPassedLevelTestTwo = unlockData && unlockData.length > 0;

      res.json({
        success: true,
        hasPassedLevelTestTwo: hasPassedLevelTestTwo,
        message: hasPassedLevelTestTwo ? 'ผู้ใช้ผ่านแบบทดสอบระดับปานกลางแล้ว' : 'ผู้ใช้ยังไม่ผ่านแบบทดสอบระดับปานกลาง',
        unlockData: unlockData || []
      });

    } catch (error) {
      console.error('Error in checking leveltesttwo unlock:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  // ตรวจสอบว่าผู้ใช้ผ่านแบบทดสอบระดับสูง (leveltestthree) หรือไม่
  router.get('/user-unlock/check-leveltestthree/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // ตรวจสอบในตาราง user_unlock ว่าผู้ใช้ผ่าน leveltestthree หรือไม่
      const { data: unlockData, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', parseInt(userId))
        .eq('test_type', 'leveltestthree');

      if (unlockError) {
        console.error('Error checking leveltestthree unlock:', error);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์',
          error: unlockError.message
        });
      }

      // ถ้ามีข้อมูลใน user_unlock แสดงว่าผ่านแล้ว
      const hasPassedLevelTestThree = unlockData && unlockData.length > 0;

      res.json({
        success: true,
        hasPassedLevelTestThree: hasPassedLevelTestThree,
        message: hasPassedLevelTestThree ? 'ผู้ใช้ผ่านแบบทดสอบระดับสูงแล้ว' : 'ผู้ใช้ยังไม่ผ่านแบบทดสอบระดับสูง',
        unlockData: unlockData || []
      });

    } catch (error) {
      console.error('Error in checking leveltestthree unlock:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  // เพิ่มข้อมูล user_unlock เมื่อผู้ใช้ผ่านแบบทดสอบ
  router.post('/user-unlock/add', async (req, res) => {
    try {
      const { userId, testType, testId } = req.body;

      if (!userId || !testType || !testId) {
        return res.status(400).json({
          success: false,
          message: 'ข้อมูลไม่ครบถ้วน'
        });
      }

      // เพิ่มข้อมูลในตาราง user_unlock
      const { data, error } = await supabase
        .from('user_unlock')
        .insert([
          {
            user_id: userId,
            test_type: testType,
            test_id: testId,
            unlocked_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Error adding user unlock:', error);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการเพิ่มสิทธิ์',
          error: error.message
        });
      }

      res.json({
        success: true,
        message: 'เพิ่มสิทธิ์สำเร็จ',
        data: data[0]
      });

    } catch (error) {
      console.error('Error in adding user unlock:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  // ดึงประวัติการปลดล็อกทั้งหมดของผู้ใช้
  router.get('/user-unlock/history/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (error) {
        console.error('Error fetching user unlock history:', error);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประวัติ',
          error: error.message
        });
      }

      res.json({
        success: true,
        data: data || [],
        message: 'ดึงประวัติสำเร็จ'
      });

    } catch (error) {
      console.error('Error in fetching user unlock history:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  // ดึงแบบทดสอบหลังเรียนตาม instrument_id
  router.get('/posttests/instrument/:instrumentId', async (req, res) => {
    try {
      const { instrumentId } = req.params;

      const { data, error } = await supabase
        .from('posttest_instrument')
        .select('*')
        .eq('instrument_id', parseInt(instrumentId));

      if (error) {
        console.error('Error fetching posttests by instrument:', error);
        return res.status(500).json({
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงแบบทดสอบหลังเรียน',
          error: error.message
        });
      }

      res.json({
        success: true,
        data: data || [],
        message: 'ดึงแบบทดสอบหลังเรียนสำเร็จ'
      });

    } catch (error) {
      console.error('Error in fetching posttests by instrument:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบ',
        error: error.message
      });
    }
  });

  return router;
};
