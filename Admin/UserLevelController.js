const express = require('express');
const router = express.Router();

// ใช้ Supabase แทน PostgreSQL
module.exports = (supabase) => {

// GET - ดึงข้อมูลระดับผู้ใช้ทั้งหมด
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_level')
      .select('*')
      .order('score', { ascending: true });
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลระดับผู้ใช้สำเร็จ',
      userLevels: data
    });
  } catch (error) {
    console.error('Error fetching user levels:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลระดับผู้ใช้',
      error: error.message
    });
  }
});

// GET - ดึงข้อมูลระดับผู้ใช้ตาม ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('user_level')
      .select('*')
      .eq('level_id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบระดับผู้ใช้ที่ระบุ'
        });
      }
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลระดับผู้ใช้สำเร็จ',
      userLevel: data
    });
  } catch (error) {
    console.error('Error fetching user level:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลระดับผู้ใช้',
      error: error.message
    });
  }
});

// POST - เพิ่มระดับผู้ใช้ใหม่
router.post('/', async (req, res) => {
  try {
    const { level_name, score } = req.body;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!level_name || score === undefined || score === null) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อระดับและคะแนน'
      });
    }
    
    // ตรวจสอบว่าชื่อระดับซ้ำหรือไม่
    const { data: existingLevel, error: levelError } = await supabase
      .from('user_level')
      .select('*')
      .eq('level_name', level_name)
      .single();
    
    if (levelError && levelError.code !== 'PGRST116') {
      throw levelError;
    }
    
    if (existingLevel) {
      return res.status(400).json({
        success: false,
        message: 'ชื่อระดับนี้มีอยู่แล้ว'
      });
    }
    
    // ตรวจสอบว่าคะแนนซ้ำหรือไม่
    const { data: existingScore, error: scoreError } = await supabase
      .from('user_level')
      .select('*')
      .eq('score', score)
      .single();
    
    if (scoreError && scoreError.code !== 'PGRST116') {
      throw scoreError;
    }
    
    if (existingScore) {
      return res.status(400).json({
        success: false,
        message: 'คะแนนนี้มีอยู่แล้ว'
      });
    }
    
    const { data, error } = await supabase
      .from('user_level')
      .insert([{ level_name, score }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      message: 'เพิ่มระดับผู้ใช้สำเร็จ',
      userLevel: data
    });
  } catch (error) {
    console.error('Error creating user level:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มระดับผู้ใช้',
      error: error.message
    });
  }
});

// PUT - แก้ไขระดับผู้ใช้
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { level_name, score } = req.body;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!level_name || score === undefined || score === null) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อระดับและคะแนน'
      });
    }
    
    // ตรวจสอบว่าระดับที่จะแก้ไขมีอยู่หรือไม่
    const { data: existingLevel, error: checkError } = await supabase
      .from('user_level')
      .select('*')
      .eq('level_id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบระดับผู้ใช้ที่ระบุ'
        });
      }
      throw checkError;
    }
    
    // ตรวจสอบว่าชื่อระดับซ้ำหรือไม่ (ยกเว้นระดับปัจจุบัน)
    const { data: duplicateName, error: nameError } = await supabase
      .from('user_level')
      .select('*')
      .eq('level_name', level_name)
      .neq('level_id', id)
      .single();
    
    if (nameError && nameError.code !== 'PGRST116') {
      throw nameError;
    }
    
    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: 'ชื่อระดับนี้มีอยู่แล้ว'
      });
    }
    
    // ตรวจสอบว่าคะแนนซ้ำหรือไม่ (ยกเว้นระดับปัจจุบัน)
    const { data: duplicateScore, error: scoreError } = await supabase
      .from('user_level')
      .select('*')
      .eq('score', score)
      .neq('level_id', id)
      .single();
    
    if (scoreError && scoreError.code !== 'PGRST116') {
      throw scoreError;
    }
    
    if (duplicateScore) {
      return res.status(400).json({
        success: false,
        message: 'คะแนนนี้มีอยู่แล้ว'
      });
    }
    
    const { data, error } = await supabase
      .from('user_level')
      .update({ level_name, score })
      .eq('level_id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      message: 'แก้ไขระดับผู้ใช้สำเร็จ',
      userLevel: data
    });
  } catch (error) {
    console.error('Error updating user level:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการแก้ไขระดับผู้ใช้',
      error: error.message
    });
  }
});

// DELETE - ลบระดับผู้ใช้
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ตรวจสอบว่าระดับที่จะลบมีอยู่หรือไม่
    const { data: existingLevel, error: checkError } = await supabase
      .from('user_level')
      .select('*')
      .eq('level_id', id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบระดับผู้ใช้ที่ระบุ'
        });
      }
      throw checkError;
    }
    
    const { error } = await supabase
      .from('user_level')
      .delete()
      .eq('level_id', id);
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      message: 'ลบระดับผู้ใช้สำเร็จ'
    });
  } catch (error) {
    console.error('Error deleting user level:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบระดับผู้ใช้',
      error: error.message
    });
  }
});

// GET - ดึงข้อมูลระดับผู้ใช้ตามคะแนน
router.get('/by-score/:score', async (req, res) => {
  try {
    const { score } = req.params;
    
    const { data, error } = await supabase
      .from('user_level')
      .select('*')
      .lte('score', score)
      .order('score', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบระดับผู้ใช้สำหรับคะแนนนี้'
        });
      }
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลระดับผู้ใช้สำเร็จ',
      userLevel: data
    });
  } catch (error) {
    console.error('Error fetching user level by score:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลระดับผู้ใช้',
      error: error.message
    });
  }
});

return router;
};