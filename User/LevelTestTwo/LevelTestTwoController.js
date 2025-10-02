// File: LevelTestTwo/LevelTestTwoController.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงรายการ leveltesttwo ทั้งหมด
  router.get('/leveltesttwo', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name
        `)
        .order('leveltesttwo_id');

      if (error) throw error;
      
      // กรองเฉพาะ leveltesttwo ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltesttwo_id', item.leveltesttwo_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltesttwo ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltesttwo_id: item.leveltesttwo_id,
            leveltwo_name: item.leveltwo_name
          });
        }
      }

      res.json({ status: 'success', data: filteredData });
    } catch (error) {
      console.error('Error fetching leveltesttwo:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltesttwo ตาม lesson_id (กรองเฉพาะที่มีใน testrequirement)
  router.get('/leveltesttwo/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;
    
    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name
        `)
        .eq('lesson_id', lessonId)
        .order('leveltesttwo_id');

      if (error) throw error;

      // กรองเฉพาะ leveltesttwo ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltesttwo_id', item.leveltesttwo_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltesttwo ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltesttwo_id: item.leveltesttwo_id,
            leveltwo_name: item.leveltwo_name
          });
        }
      }
      
      res.json({ status: 'success', data: filteredData });
    } catch (error) {
      console.error('Error fetching leveltesttwo by lesson:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltesttwo ทั้งหมดตาม lesson_id (ไม่กรอง)
  router.get('/leveltesttwo/all/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;
    
    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name
        `)
        .eq('lesson_id', lessonId)
        .order('leveltesttwo_id');

      if (error) throw error;
      
      res.json({ status: 'success', data: data });
    } catch (error) {
      console.error('Error fetching all leveltesttwo by lesson:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltesttwo ปานกลาง (Level 2) ตาม lesson_id
  router.get('/leveltesttwo/intermediate/:lessonId', async (req, res) => {
    const { lessonId } = req.params;
    
    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }
    
    try {
      // ดึง leveltesttwo_instrument ตาม lesson_id
      const { data: levelTests, error: levelTestError } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name
        `)
        .eq('lesson_id', lessonId)
        .order('leveltesttwo_id')
        .limit(1);

      if (levelTestError) throw levelTestError;

      if (!levelTests || levelTests.length === 0) {
        return res.json({ status: 'success', data: null });
      }

      // ตรวจสอบว่ามีข้อมูลใน testrequirement_instrument หรือไม่
      const { data: testRequirements, error: requirementError } = await supabase
        .from('testrequirement_instrument')
        .select('requirement_id, passing_score')
        .eq('leveltesttwo_id', levelTests[0].leveltesttwo_id);

      if (requirementError) throw requirementError;

      // ถ้าไม่มีข้อมูลใน testrequirement_instrument ให้ส่งคืน null
      if (!testRequirements || testRequirements.length === 0) {
        return res.json({ status: 'success', data: null });
      }

      // ส่งคืน leveltesttwo แรกที่พบสำหรับบทเรียนนี้
      res.json({ 
        status: 'success', 
        data: {
          leveltesttwo_id: levelTests[0].leveltesttwo_id,
          leveltwo_name: levelTests[0].leveltwo_name
        }
      });
    } catch (error) {
      console.error('Error fetching intermediate leveltesttwo:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
