// File: TestRequirement/TestRequirementController.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงรายการ test requirement ทั้งหมด
  router.get('/testrequirements', async (req, res) => {
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

  // GET: ดึง test requirement ตาม leveltestone_id
  router.get('/testrequirements/leveltestone/:leveltestoneId', async (req, res) => {
    const { leveltestoneId } = req.params;
    
    if (!leveltestoneId || isNaN(leveltestoneId)) {
      return res.status(400).json({ error: 'Valid LevelTestOne ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .select(`
          requirement_id,
          passing_score,
          leveltestone_instrument (
            leveltestone_id,
            leveltestone_name
          )
        `)
        .eq('leveltestone_id', leveltestoneId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            status: 'error', 
            message: 'ไม่พบเกณฑ์คะแนนสำหรับแบบทดสอบนี้' 
          });
        }
        throw error;
      }

      const transformedData = {
        requirement_id: data.requirement_id,
        passing_score: data.passing_score,
        leveltestone: data.leveltestone_instrument ? {
          leveltestone_id: data.leveltestone_instrument.leveltestone_id,
          leveltestone_name: data.leveltestone_instrument.leveltestone_name
        } : null
      };

      res.json({ status: 'success', data: transformedData });
    } catch (error) {
      console.error('Error fetching test requirement by leveltestone:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง test requirement ตาม leveltesttwo_id
  router.get('/testrequirements/leveltesttwo/:leveltesttwoId', async (req, res) => {
    const { leveltesttwoId } = req.params;
    
    if (!leveltesttwoId || isNaN(leveltesttwoId)) {
      return res.status(400).json({ error: 'Valid LevelTestTwo ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .select(`
          requirement_id,
          passing_score,
          leveltesttwo_instrument (
            leveltesttwo_id,
            leveltwo_name
          )
        `)
        .eq('leveltesttwo_id', leveltesttwoId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            status: 'error', 
            message: 'ไม่พบเกณฑ์คะแนนสำหรับแบบทดสอบนี้' 
          });
        }
        throw error;
      }

      const transformedData = {
        requirement_id: data.requirement_id,
        passing_score: data.passing_score,
        leveltesttwo: data.leveltesttwo_instrument ? {
          leveltesttwo_id: data.leveltesttwo_instrument.leveltesttwo_id,
          leveltwo_name: data.leveltesttwo_instrument.leveltwo_name
        } : null
      };

      res.json({ status: 'success', data: transformedData });
    } catch (error) {
      console.error('Error fetching test requirement by leveltesttwo:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง test requirement ตาม leveltestthree_id
  router.get('/testrequirements/leveltestthree/:leveltestthreeId', async (req, res) => {
    const { leveltestthreeId } = req.params;
    
    if (!leveltestthreeId || isNaN(leveltestthreeId)) {
      return res.status(400).json({ error: 'Valid LevelTestThree ID is required' });
    }
    
    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .select(`
          requirement_id,
          passing_score,
          leveltestthree_instrument (
            leveltestthree_id,
            levelthree_name
          )
        `)
        .eq('leveltestthree_id', leveltestthreeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            status: 'error', 
            message: 'ไม่พบเกณฑ์คะแนนสำหรับแบบทดสอบนี้' 
          });
        }
        throw error;
      }

      const transformedData = {
        requirement_id: data.requirement_id,
        passing_score: data.passing_score,
        leveltestthree: data.leveltestthree_instrument ? {
          leveltestthree_id: data.leveltestthree_instrument.leveltestthree_id,
          levelthree_name: data.leveltestthree_instrument.levelthree_name
        } : null
      };

      res.json({ status: 'success', data: transformedData });
    } catch (error) {
      console.error('Error fetching test requirement by leveltestthree:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // POST: สร้าง test requirement ใหม่
  router.post('/testrequirements', async (req, res) => {
    const { leveltestone_id, leveltesttwo_id, leveltestthree_id, passing_score } = req.body;

    if (!passing_score || passing_score < 0 || passing_score > 100) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุคะแนนผ่านเกณฑ์ที่ถูกต้อง (0-100)' 
      });
    }

    // ตรวจสอบว่าต้องมีอย่างน้อยหนึ่ง level test
    if (!leveltestone_id && !leveltesttwo_id && !leveltestthree_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ level test อย่างน้อยหนึ่งรายการ' 
      });
    }

    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .insert({
          leveltestone_id: leveltestone_id || null,
          leveltesttwo_id: leveltesttwo_id || null,
          leveltestthree_id: leveltestthree_id || null,
          passing_score: passing_score
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ 
        status: 'success', 
        message: 'สร้างเกณฑ์คะแนนสำเร็จ',
        data: data
      });
    } catch (error) {
      console.error('Error creating test requirement:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // PUT: อัปเดต test requirement
  router.put('/testrequirements/:requirementId', async (req, res) => {
    const { requirementId } = req.params;
    const { leveltestone_id, leveltesttwo_id, leveltestthree_id, passing_score } = req.body;

    if (!requirementId || isNaN(requirementId)) {
      return res.status(400).json({ error: 'Valid Requirement ID is required' });
    }

    if (!passing_score || passing_score < 0 || passing_score > 100) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุคะแนนผ่านเกณฑ์ที่ถูกต้อง (0-100)' 
      });
    }

    try {
      const { data, error } = await supabase
        .from('testrequirement_instrument')
        .update({
          leveltestone_id: leveltestone_id || null,
          leveltesttwo_id: leveltesttwo_id || null,
          leveltestthree_id: leveltestthree_id || null,
          passing_score: passing_score
        })
        .eq('requirement_id', requirementId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            status: 'error', 
            message: 'ไม่พบเกณฑ์คะแนนที่ต้องการอัปเดต' 
          });
        }
        throw error;
      }

      res.json({ 
        status: 'success', 
        message: 'อัปเดตเกณฑ์คะแนนสำเร็จ',
        data: data
      });
    } catch (error) {
      console.error('Error updating test requirement:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // DELETE: ลบ test requirement
  router.delete('/testrequirements/:requirementId', async (req, res) => {
    const { requirementId } = req.params;

    if (!requirementId || isNaN(requirementId)) {
      return res.status(400).json({ error: 'Valid Requirement ID is required' });
    }

    try {
      const { error } = await supabase
        .from('testrequirement_instrument')
        .delete()
        .eq('requirement_id', requirementId);

      if (error) throw error;

      res.json({ 
        status: 'success', 
        message: 'ลบเกณฑ์คะแนนสำเร็จ'
      });
    } catch (error) {
      console.error('Error deleting test requirement:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
