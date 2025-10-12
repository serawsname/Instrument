// File: Posttest/PosttestController.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงรายการ posttest ทั้งหมด
  router.get('/posttests', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name,
          instrument_id,
          thai_instrument (
            thaiinstrument_id,
            thaiinstrument_name,
            thaiinstrument_type
          )
        `)
        .order('posttest_id');

      if (error) throw error;
      res.json({ status: 'success', data });
    } catch (error) {
      console.error('Error fetching posttests:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง posttest ตาม instrument_id
  router.get('/posttests/instrument/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    
    try {
      const { data, error } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name,
          instrument_id,
          thai_instrument (
            thaiinstrument_id,
            thaiinstrument_name,
            thaiinstrument_type
          )
        `)
        .eq('instrument_id', instrumentId)
        .order('posttest_id');

      if (error) throw error;
      res.json({ status: 'success', data });
    } catch (error) {
      console.error('Error fetching posttests by instrument:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง posttest ตาม posttest_id
  router.get('/posttests/:posttestId', async (req, res) => {
    const { posttestId } = req.params;
    
    try {
      const { data, error } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name,
          instrument_id,
          thai_instrument (
            thaiinstrument_id,
            thaiinstrument_name,
            thaiinstrument_type
          )
        `)
        .eq('posttest_id', posttestId)
        .single();

      if (error) throw error;
      res.json({ status: 'success', data });
    } catch (error) {
      console.error('Error fetching posttest:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // GET: ดึง posttest ตาม lesson_id
  router.get('/posttests/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;
    
    try {
      // ดึง lesson เพื่อหา thaiinstrument_id
      const { data: lesson, error: lessonError } = await supabase
        .from('lesson_instrument')
        .select('thaiinstrument_id')
        .eq('lesson_id', lessonId)
        .single();

      if (lessonError) throw lessonError;

      // ดึง posttest ที่เกี่ยวข้องกับ instrument นี้
      const { data: posttests, error: posttestError } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name,
          instrument_id
        `)
        .eq('instrument_id', lesson.thaiinstrument_id)
        .order('posttest_id');

      if (posttestError) throw posttestError;
      res.json({ status: 'success', data: posttests });
    } catch (error) {
      console.error('Error fetching posttests by lesson:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
