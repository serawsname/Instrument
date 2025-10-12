const express = require('express');
const authenticateToken = require('../User/middleware/authenticateToken');

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

module.exports = (supabase) => {
  const router = express.Router();

  // GET: ดึงบทเรียนทั้งหมด
  router.get('/lessons', authenticateToken, requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('lesson_instrument')
      .select(`
        *,
        thai_instrument (
          thaiinstrument_name
        )
      `)
      .order('lesson_id');

    if (error) {
      console.error('Error fetching lessons:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // GET: ดึงบทเรียนของเครื่องดนตรีเฉพาะ
  router.get('/instruments/:instrumentId/lessons', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    
    const { data, error } = await supabase
      .from('lesson_instrument')
      .select(`
        *,
        thai_instrument (
          thaiinstrument_name
        )
      `)
      .eq('thaiinstrument_id', instrumentId)
      .order('lesson_id');

    if (error) {
      console.error('Error fetching lessons:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มบทเรียนใหม่
  router.post('/lessons', authenticateToken, requireAdmin, async (req, res) => {
    const { lesson_name, thaiinstrument_id } = req.body;

    if (!lesson_name || !thaiinstrument_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('lesson_instrument')
      .insert([{
        lesson_name,
        thaiinstrument_id: parseInt(thaiinstrument_id)
      }])
      .select(`
        *,
        thai_instrument (
          thaiinstrument_name
        )
      `);

    if (error) {
      console.error('Error inserting lesson:', error);
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขบทเรียน
  router.put('/lessons/:lessonId', authenticateToken, requireAdmin, async (req, res) => {
    const { lessonId } = req.params;
    const { lesson_name } = req.body;

    if (!lesson_name) {
      return res.status(400).json({ error: 'Missing lesson_name' });
    }

    const { data, error } = await supabase
      .from('lesson_instrument')
      .update({
        lesson_name
      })
      .eq('lesson_id', lessonId)
      .select(`
        *,
        thai_instrument (
          thaiinstrument_name
        )
      `);

    if (error) {
      console.error('Error updating lesson:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบบทเรียน
  router.delete('/lessons/:lessonId', authenticateToken, requireAdmin, async (req, res) => {
    const { lessonId } = req.params;

    const { error } = await supabase
      .from('lesson_instrument')
      .delete()
      .eq('lesson_id', lessonId);

    if (error) {
      console.error('Error deleting lesson:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Lesson deleted successfully' });
  });

  // GET: ดึงเนื้อหาการเรียนรู้ทั้งหมด
  router.get('/learning', authenticateToken, requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('learning_instrument')
      .select(`
        *,
        lesson_instrument (
          lesson_name,
          thai_instrument (
            thaiinstrument_name
          )
        )
      `)
      .order('learning_id');

    if (error) {
      console.error('Error fetching learning content:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // GET: ดึงเนื้อหาการเรียนรู้ของบทเรียนเฉพาะ
  router.get('/lessons/:lessonId/learning', authenticateToken, requireAdmin, async (req, res) => {
    const { lessonId } = req.params;
    
    const { data, error } = await supabase
      .from('learning_instrument')
      .select(`
        *,
        lesson_instrument (
          lesson_name,
          thai_instrument (
            thaiinstrument_name
          )
        )
      `)
      .eq('lesson_id', lessonId)
      .order('learning_id');

    if (error) {
      console.error('Error fetching learning content:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มเนื้อหาการเรียนรู้ใหม่
  router.post('/learning', authenticateToken, requireAdmin, async (req, res) => {
    const { learning_name, learning_text, lesson_id } = req.body;

    if (!learning_name || !lesson_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('learning_instrument')
      .insert([{
        learning_name,
        learning_text: learning_text || null,
        lesson_id: parseInt(lesson_id)
      }])
      .select(`
        *,
        lesson_instrument (
          lesson_name,
          thai_instrument (
            thaiinstrument_name
          )
        )
      `);

    if (error) {
      console.error('Error inserting learning content:', error);
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขเนื้อหาการเรียนรู้
  router.put('/learning/:learningId', authenticateToken, requireAdmin, async (req, res) => {
    const { learningId } = req.params;
    const { learning_name, learning_text } = req.body;

    if (!learning_name) {
      return res.status(400).json({ error: 'Missing learning_name' });
    }

    const { data, error } = await supabase
      .from('learning_instrument')
      .update({
        learning_name,
        learning_text: learning_text || null
      })
      .eq('learning_id', learningId)
      .select(`
        *,
        lesson_instrument (
          lesson_name,
          thai_instrument (
            thaiinstrument_name
          )
        )
      `);

    if (error) {
      console.error('Error updating learning content:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบเนื้อหาการเรียนรู้
  router.delete('/learning/:learningId', authenticateToken, requireAdmin, async (req, res) => {
    const { learningId } = req.params;

    const { error } = await supabase
      .from('learning_instrument')
      .delete()
      .eq('learning_id', learningId);

    if (error) {
      console.error('Error deleting learning content:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Learning content deleted successfully' });
  });

  return router;
};