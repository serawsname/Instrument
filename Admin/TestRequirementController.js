// Admin/TestRequirementController.js - API สำหรับจัดการ test requirements (เฉพาะ admin)

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
  // PUT: อัปเดต test requirement ที่มีอยู่แล้ว
  router.put('/test-requirements/:requirementId', authenticateToken, requireAdmin, async (req, res) => {
    const { requirementId } = req.params;
    const { levelTestOneId, levelTestTwoId, levelTestThreeId, passingScore } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!passingScore || passingScore < 0 || passingScore > 100) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุคะแนนผ่านเกณฑ์ที่ถูกต้อง (0-100)' 
      });
    }

    // ตรวจสอบว่าต้องมีอย่างน้อยหนึ่ง level test
    if (!levelTestOneId && !levelTestTwoId && !levelTestThreeId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ level test อย่างน้อยหนึ่งรายการ' 
      });
    }

    try {
      console.log('Updating requirement:', { requirementId, levelTestOneId, levelTestTwoId, levelTestThreeId, passingScore });
      
      // ตรวจสอบว่า level test ที่เลือกมีอยู่จริงหรือไม่
      const validationPromises = [];
      
      if (levelTestOneId) {
        validationPromises.push(
          supabase
            .from('leveltestone_instrument')
            .select('leveltestone_id')
            .eq('leveltestone_id', levelTestOneId)
            .single()
        );
      }
      
      if (levelTestTwoId) {
        validationPromises.push(
          supabase
            .from('leveltesttwo_instrument')
            .select('leveltesttwo_id')
            .eq('leveltesttwo_id', levelTestTwoId)
            .single()
        );
      }
      
      if (levelTestThreeId) {
        validationPromises.push(
          supabase
            .from('leveltestthree_instrument')
            .select('leveltestthree_id')
            .eq('leveltestthree_id', levelTestThreeId)
            .single()
        );
      }

      const validationResults = await Promise.allSettled(validationPromises);
      const hasInvalidTest = validationResults.some(result => 
        result.status === 'rejected' || result.value.error
      );

      if (hasInvalidTest) {
        return res.status(400).json({
          status: 'error',
          message: 'ไม่พบ level test ที่เลือก กรุณาตรวจสอบข้อมูลอีกครั้ง'
        });
      }

      // อัปเดต requirement ที่ระบุ
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .update({
          leveltestone_id: levelTestOneId || null,
          leveltesttwo_id: levelTestTwoId || null,
          leveltestthree_id: levelTestThreeId || null,
          passing_score: parseInt(passingScore)
        })
        .eq('requirement_id', requirementId)
        .select(`
          requirement_id,
          passing_score,
          leveltestone_id,
          leveltesttwo_id,
          leveltestthree_id
        `)
        .single();

      if (error) {
        console.error('Error updating test requirement:', error);
        return res.status(500).json({ 
          status: 'error', 
          message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
          error: error.message || error
        });
      }

      res.json({ 
        status: 'success', 
        message: 'อัปเดตเกณฑ์คะแนนสำเร็จ',
        data: data
      });

    } catch (error) {
      console.error('Error in test-requirements PUT:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'เกิดข้อผิดพลาดในระบบ' 
      });
    }
  });

  // POST: สร้าง test requirement ใหม่
  router.post('/test-requirements', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId, passingScore, levelTestOneId, levelTestTwoId, levelTestThreeId } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!passingScore || passingScore < 0 || passingScore > 100) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุคะแนนผ่านเกณฑ์ที่ถูกต้อง (0-100)' 
      });
    }

    // ตรวจสอบว่าต้องมีอย่างน้อยหนึ่ง level test
    if (!levelTestOneId && !levelTestTwoId && !levelTestThreeId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ level test อย่างน้อยหนึ่งรายการ' 
      });
    }

    try {
      console.log('Received data:', { instrumentId, passingScore, levelTestOneId, levelTestTwoId, levelTestThreeId });
      
      // ตรวจสอบว่า level test ที่เลือกมีอยู่จริงหรือไม่
      const validationPromises = [];
      
      if (levelTestOneId) {
        validationPromises.push(
          supabase
            .from('leveltestone_instrument')
            .select('leveltestone_id')
            .eq('leveltestone_id', levelTestOneId)
            .single()
        );
      }
      
      if (levelTestTwoId) {
        validationPromises.push(
          supabase
            .from('leveltesttwo_instrument')
            .select('leveltesttwo_id')
            .eq('leveltesttwo_id', levelTestTwoId)
            .single()
        );
      }
      
      if (levelTestThreeId) {
        validationPromises.push(
          supabase
            .from('leveltestthree_instrument')
            .select('leveltestthree_id')
            .eq('leveltestthree_id', levelTestThreeId)
            .single()
        );
      }

      const validationResults = await Promise.allSettled(validationPromises);
      const hasInvalidTest = validationResults.some(result => 
        result.status === 'rejected' || result.value.error
      );

      if (hasInvalidTest) {
        return res.status(400).json({
          status: 'error',
          message: 'ไม่พบ level test ที่เลือก กรุณาตรวจสอบข้อมูลอีกครั้ง'
        });
      }

      // ตรวจสอบว่ามี requirement ที่มี level test combination เดียวกันอยู่แล้วหรือไม่
      let query = supabase.from('testrequirement_instrument').select('*');
      
      if (levelTestOneId) {
        query = query.eq('leveltestone_id', levelTestOneId);
      } else {
        query = query.is('leveltestone_id', null);
      }
      
      if (levelTestTwoId) {
        query = query.eq('leveltesttwo_id', levelTestTwoId);
      } else {
        query = query.is('leveltesttwo_id', null);
      }
      
      if (levelTestThreeId) {
        query = query.eq('leveltestthree_id', levelTestThreeId);
      } else {
        query = query.is('leveltestthree_id', null);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      console.log('Existing requirement found:', existing);
      
      let data, error;
      
      if (existing) {
        console.log('Updating existing requirement:', existing.requirement_id);
        // อัปเดต requirement ที่มีอยู่แล้ว
        const updateResult = await supabase
          .from('testrequirement_instrument')
          .update({
            leveltestone_id: levelTestOneId || null,
            leveltesttwo_id: levelTestTwoId || null,
            leveltestthree_id: levelTestThreeId || null,
            passing_score: parseInt(passingScore)
          })
          .eq('requirement_id', existing.requirement_id)
          .select(`
            requirement_id,
            passing_score,
            leveltestone_id,
            leveltesttwo_id,
            leveltestthree_id
          `)
          .single();
        
        data = updateResult.data;
        error = updateResult.error;
      } else {
        console.log('Creating new requirement');
        // สร้าง requirement ใหม่
        const insertResult = await supabase
          .from('testrequirement_instrument')
          .insert({
            leveltestone_id: levelTestOneId || null,
            leveltesttwo_id: levelTestTwoId || null,
            leveltestthree_id: levelTestThreeId || null,
            passing_score: parseInt(passingScore)
          })
          .select(`
            requirement_id,
            passing_score,
            leveltestone_id,
            leveltesttwo_id,
            leveltestthree_id
          `)
          .single();
        
        data = insertResult.data;
        error = insertResult.error;
      }

      if (error) {
        console.error('Error creating test requirement:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return res.status(500).json({ 
          status: 'error', 
          message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
          error: error.message || error
        });
      }

      res.status(201).json({ 
        status: 'success', 
        message: 'บันทึกเกณฑ์คะแนนสำเร็จ',
        data: data
      });

    } catch (error) {
      console.error('Error in test-requirements POST:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'เกิดข้อผิดพลาดในระบบ' 
      });
    }
  });

  // GET: ดึงรายการ test requirement ทั้งหมด (สำหรับ admin)
  router.get('/test-requirements', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .select(`
          requirement_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_id,
            leveltestone_name
          ),
          leveltesttwo_instrument (
            leveltesttwo_id,
            leveltwo_name
          ),
          leveltestthree_instrument (
            leveltestthree_id,
            levelthree_name
          )
        `)
        .order('requirement_id');

      if (error) throw error;

      // Transform data to match expected format
      const transformedData = data.map(item => ({
        requirement_id: item.requirement_id,
        passing_score: item.passing_score,
        leveltestone: item.leveltestone_instrument ? {
          leveltestone_id: item.leveltestone_instrument.leveltestone_id,
          leveltestone_name: item.leveltestone_instrument.leveltestone_name
        } : null,
        leveltesttwo: item.leveltesttwo_instrument ? {
          leveltesttwo_id: item.leveltesttwo_instrument.leveltesttwo_id,
          leveltwo_name: item.leveltesttwo_instrument.leveltwo_name
        } : null,
        leveltestthree: item.leveltestthree_instrument ? {
          leveltestthree_id: item.leveltestthree_instrument.leveltestthree_id,
          levelthree_name: item.leveltestthree_instrument.levelthree_name
        } : null
      }));

      res.json({ status: 'success', data: transformedData });
    } catch (error) {
      console.error('Error fetching test requirements:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึงรายการ leveltestone ทั้งหมด (สำหรับ admin - ไม่กรองตาม testrequirement)
  router.get('/leveltestone/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltestone_instrument')
        .select(`
          leveltestone_id,
          leveltestone_name,
          thaiinstrument_id,
          thai_instrument (
            thaiinstrument_id,
            thaiinstrument_name,
            thaiinstrument_type
          )
        `)
        .order('leveltestone_id');

      if (error) throw error;

      res.json({ status: 'success', data: data });
    } catch (error) {
      console.error('Error fetching all leveltestone:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึงรายการ leveltesttwo ทั้งหมด (สำหรับ admin - ไม่กรองตาม testrequirement)
  router.get('/leveltesttwo/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name,
          lesson_id,
          lesson_instrument (
            lesson_id,
            lesson_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_id,
              thaiinstrument_name,
              thaiinstrument_type
            )
          )
        `)
        .order('leveltesttwo_id');

      if (error) throw error;

      res.json({ status: 'success', data: data });
    } catch (error) {
      console.error('Error fetching all leveltesttwo:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึงรายการ leveltestthree ทั้งหมด (สำหรับ admin - ไม่กรองตาม testrequirement)
  router.get('/leveltestthree/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name,
          lesson_id,
          lesson_instrument (
            lesson_id,
            lesson_name,
            thaiinstrument_id,
            thai_instrument (
              thaiinstrument_id,
              thaiinstrument_name,
              thaiinstrument_type
            )
          )
        `)
        .order('leveltestthree_id');

      if (error) throw error;

      res.json({ status: 'success', data: data });
    } catch (error) {
      console.error('Error fetching all leveltestthree:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};