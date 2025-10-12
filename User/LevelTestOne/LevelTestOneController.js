// File: LevelTestOne/LevelTestOneController.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงรายการ leveltestone ทั้งหมด
  router.get('/leveltestone', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leveltestone_instrument')
        .select(`
          leveltestone_id,
          leveltestone_name
        `)
        .order('leveltestone_id');

      if (error) throw error;
      
      // กรองเฉพาะ leveltestone ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltestone_id', item.leveltestone_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltestone ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltestone_id: item.leveltestone_id,
            leveltestone_name: item.leveltestone_name
          });
        }
      }

      res.json({ status: 'success', data: filteredData });
    } catch (error) {
      console.error('Error fetching leveltestone:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltestone ตาม instrument_id (กรองเฉพาะที่มีใน testrequirement)
  router.get('/leveltestone/instrument/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    
    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('leveltestone_instrument')
        .select(`
          leveltestone_id,
          leveltestone_name
        `)
        .eq('thaiinstrument_id', instrumentId)
        .order('leveltestone_id');

      if (error) throw error;

      // กรองเฉพาะ leveltestone ที่มีข้อมูลใน testrequirement_instrument
      const filteredData = [];
      for (const item of data) {
        const { data: testRequirements, error: requirementError } = await supabase
          .from('testrequirement_instrument')
          .select('requirement_id')
          .eq('leveltestone_id', item.leveltestone_id);

        if (requirementError) throw requirementError;

        // เพิ่มเฉพาะ leveltestone ที่มีข้อมูลใน testrequirement_instrument
        if (testRequirements && testRequirements.length > 0) {
          filteredData.push({
            leveltestone_id: item.leveltestone_id,
            leveltestone_name: item.leveltestone_name
          });
        }
      }
      
      res.json({ status: 'success', data: filteredData });
    } catch (error) {
      console.error('Error fetching leveltestone by instrument:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltestone ทั้งหมดตาม instrument_id (ไม่กรอง)
  router.get('/leveltestone/all/instrument/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    
    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('leveltestone_instrument')
        .select(`
          leveltestone_id,
          leveltestone_name
        `)
        .eq('thaiinstrument_id', instrumentId)
        .order('leveltestone_id');

      if (error) throw error;
      
      res.json({ status: 'success', data: data });
    } catch (error) {
      console.error('Error fetching all leveltestone by instrument:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง leveltestone พื้นฐาน (Level 1) ตาม instrument_id
  router.get('/leveltestone/basic/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    
    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }
    
    try {
      // ดึง leveltestone_instrument ตาม thaiinstrument_id
      const { data: levelTests, error: levelTestError } = await supabase
        .from('leveltestone_instrument')
        .select(`
          leveltestone_id,
          leveltestone_name
        `)
        .eq('thaiinstrument_id', instrumentId)
        .order('leveltestone_id')
        .limit(1);

      if (levelTestError) throw levelTestError;

      if (!levelTests || levelTests.length === 0) {
        return res.json({ status: 'success', data: null });
      }

      // ตรวจสอบว่ามีข้อมูลใน leveltestone_score หรือไม่ (ใช้ระบบใหม่)
      const { data: levelTestScore, error: scoreError } = await supabase
        .from('leveltestone_score')
        .select('passing_score')
        .eq('leveltestone_id', levelTests[0].leveltestone_id);

      if (scoreError) throw scoreError;

      // ถ้าไม่มีข้อมูลใน leveltestone_score ให้ส่งคืน null
      if (!levelTestScore || levelTestScore.length === 0) {
        return res.json({ status: 'success', data: null });
      }

      // ส่งคืน leveltestone แรกที่พบสำหรับเครื่องดนตรีนี้
      res.json({ 
        status: 'success', 
        data: {
          leveltestone_id: levelTests[0].leveltestone_id,
          leveltestone_name: levelTests[0].leveltestone_name
        }
      });
    } catch (error) {
      console.error('Error fetching basic leveltestone:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึงเกณฑ์การผ่านสำหรับ Level Test One จากตาราง leveltestone_score
  router.get('/leveltestone/passing-score/:levelTestOneId', async (req, res) => {
    const { levelTestOneId } = req.params;
    
    if (!levelTestOneId || isNaN(levelTestOneId)) {
      return res.status(400).json({ error: 'Valid Level Test One ID is required' });
    }
    
    try {
      const { data: scoreData, error: scoreError } = await supabase
        .from('leveltestone_score')
        .select('passing_score')
        .eq('leveltestone_id', levelTestOneId)
        .single();

      if (scoreError) {
        if (scoreError.code === 'PGRST116') {
          // ไม่พบข้อมูล
          return res.json({ 
            status: 'success', 
            data: { 
              passing_score: null,
              message: 'ไม่พบเกณฑ์การผ่านสำหรับแบบทดสอบนี้'
            }
          });
        }
        throw scoreError;
      }

      res.json({ 
        status: 'success', 
        data: { 
          passing_score: scoreData.passing_score 
        }
      });
    } catch (error) {
      console.error('Error fetching passing score:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
