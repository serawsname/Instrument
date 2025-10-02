// File: LevelTestThree/LevelTestThreeController.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงรายการ leveltestthree ทั้งหมด
  router.get('/leveltestthree', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name
        `)
        .order('leveltestthree_id');

      if (error) throw error;
      
      // กรองเฉพาะ leveltestthree ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltestthree_id', item.leveltestthree_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltestthree ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltestthree_id: item.leveltestthree_id,
            levelthree_name: item.levelthree_name
          });
        }
      }

      res.json({ status: 'success', data: filteredData });
    } catch (error) {
      console.error('Error fetching leveltestthree:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltestthree ตาม lesson_id (กรองเฉพาะที่มีใน testrequirement)
  router.get('/leveltestthree/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name,
          lesson_id
        `)
        .eq('lesson_id', parseInt(lessonId));

      if (error) {
        throw error;
      }

      // กรองเฉพาะ leveltestthree ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltestthree_id', item.leveltestthree_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltestthree ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltestthree_id: item.leveltestthree_id,
            levelthree_name: item.levelthree_name,
            lesson_id: item.lesson_id
          });
        }
      }

      res.status(200).json({
        success: true,
        data: filteredData || [],
      });
    } catch (err) {
      console.error('Error fetching level test three for lesson:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึง leveltestthree ทั้งหมดตาม lesson_id (ไม่กรอง)
  router.get('/leveltestthree/all/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name,
          lesson_id
        `)
        .eq('lesson_id', parseInt(lessonId));

      if (error) {
        throw error;
      }

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      console.error('Error fetching all level test three for lesson:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
};
