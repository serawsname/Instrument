// Admin/LevelTestOneScoreController.js - API สำหรับจัดการ passing score ของ Level Test One (เฉพาะ admin)

const express = require('express');
const router = express.Router();
const authenticateToken = require('../User/middleware/authenticateToken');

// Middleware ตรวจสอบ role admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

module.exports = (supabase) => {
  // GET: ดึงข้อมูล passing score ทั้งหมดของ Level Test One
  router.get('/leveltestone-scores', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltestone_score')
        .select(`
          leveltestonescore_id,
          leveltestone_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_name
            )
          )
        `)
        .order('leveltestonescore_id', { ascending: true });

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'ดึงข้อมูล passing score สำเร็จ',
        data: data || []
      });
    } catch (error) {
      console.error('Error fetching Level Test One scores:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล passing score',
        error: error.message
      });
    }
  });

  // GET: ดึงข้อมูล passing score ตาม leveltestone_id
  router.get('/leveltestone-scores/:levelTestOneId', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { levelTestOneId } = req.params;

      const { data, error } = await supabase
        .from('leveltestone_score')
        .select(`
          leveltestonescore_id,
          leveltestone_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_name
            )
          )
        `)
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบข้อมูล passing score สำหรับ Level Test One นี้'
          });
        }
        throw error;
      }

      res.status(200).json({
        success: true,
        message: 'ดึงข้อมูล passing score สำเร็จ',
        data: data
      });
    } catch (error) {
      console.error('Error fetching Level Test One score:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล passing score',
        error: error.message
      });
    }
  });

  // POST: สร้าง passing score ใหม่สำหรับ Level Test One
  router.post('/leveltestone-scores', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { levelTestOneId, passingScore } = req.body;

      // ตรวจสอบข้อมูลที่จำเป็น
      if (!levelTestOneId || passingScore === undefined || passingScore === null) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ Level Test One ID และคะแนนผ่าน'
        });
      }

      // ตรวจสอบว่าคะแนนผ่านอยู่ในช่วงที่ถูกต้อง
      if (passingScore < 0 || passingScore > 100) {
        return res.status(400).json({
          success: false,
          message: 'คะแนนผ่านต้องอยู่ระหว่าง 0-100'
        });
      }

      // ตรวจสอบว่า Level Test One มีอยู่จริง
      const { data: levelTestOne, error: levelTestError } = await supabase
        .from('leveltestone_instrument')
        .select('leveltestone_id, leveltestone_name')
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (levelTestError) {
        if (levelTestError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบ Level Test One ที่ระบุ'
          });
        }
        throw levelTestError;
      }

      // ตรวจสอบว่ามี passing score สำหรับ Level Test One นี้อยู่แล้วหรือไม่
      const { data: existingScore, error: existingError } = await supabase
        .from('leveltestone_score')
        .select('leveltestonescore_id')
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existingScore) {
        return res.status(400).json({
          success: false,
          message: 'Level Test One นี้มี passing score อยู่แล้ว กรุณาใช้การอัปเดตแทน'
        });
      }

      // สร้าง passing score ใหม่
      const { data, error } = await supabase
        .from('leveltestone_score')
        .insert([{
          leveltestone_id: levelTestOneId,
          passing_score: parseInt(passingScore)
        }])
        .select(`
          leveltestonescore_id,
          leveltestone_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_name
            )
          )
        `)
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        message: 'สร้าง passing score สำเร็จ',
        data: data
      });
    } catch (error) {
      console.error('Error creating Level Test One score:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการสร้าง passing score',
        error: error.message
      });
    }
  });

  // PUT: อัปเดต passing score ของ Level Test One
  router.put('/leveltestone-scores/:levelTestOneId', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { levelTestOneId } = req.params;
      const { passingScore } = req.body;

      // ตรวจสอบข้อมูลที่จำเป็น
      if (passingScore === undefined || passingScore === null) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุคะแนนผ่าน'
        });
      }

      // ตรวจสอบว่าคะแนนผ่านอยู่ในช่วงที่ถูกต้อง
      if (passingScore < 0 || passingScore > 100) {
        return res.status(400).json({
          success: false,
          message: 'คะแนนผ่านต้องอยู่ระหว่าง 0-100'
        });
      }

      // ตรวจสอบว่ามี passing score สำหรับ Level Test One นี้อยู่หรือไม่
      const { data: existingScore, error: existingError } = await supabase
        .from('leveltestone_score')
        .select('leveltestonescore_id')
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (existingError) {
        if (existingError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบ passing score สำหรับ Level Test One นี้'
          });
        }
        throw existingError;
      }

      // อัปเดต passing score
      const { data, error } = await supabase
        .from('leveltestone_score')
        .update({
          passing_score: parseInt(passingScore)
        })
        .eq('leveltestone_id', levelTestOneId)
        .select(`
          leveltestonescore_id,
          leveltestone_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_name
            )
          )
        `)
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'อัปเดต passing score สำเร็จ',
        data: data
      });
    } catch (error) {
      console.error('Error updating Level Test One score:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัปเดต passing score',
        error: error.message
      });
    }
  });

  // DELETE: ลบ passing score ของ Level Test One
  router.delete('/leveltestone-scores/:levelTestOneId', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { levelTestOneId } = req.params;

      // ตรวจสอบว่ามี passing score สำหรับ Level Test One นี้อยู่หรือไม่
      const { data: existingScore, error: existingError } = await supabase
        .from('leveltestone_score')
        .select('leveltestonescore_id')
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (existingError) {
        if (existingError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            message: 'ไม่พบ passing score สำหรับ Level Test One นี้'
          });
        }
        throw existingError;
      }

      // ลบ passing score
      const { error } = await supabase
        .from('leveltestone_score')
        .delete()
        .eq('leveltestone_id', levelTestOneId);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'ลบ passing score สำเร็จ'
      });
    } catch (error) {
      console.error('Error deleting Level Test One score:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการลบ passing score',
        error: error.message
      });
    }
  });

  return router;
};