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

  // GET: ดึง answermatch ทั้งหมดของ question
  router.get('/questions/:questionId/answermatch', async (req, res) => {
    const { questionId } = req.params;
    const { data, error } = await supabase
      .from('answermatch_instrument')
      .select('*')
      .eq('questiontext_id', questionId)
      .order('answermatch_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่ม answermatch ใหม่
  router.post('/answermatch', async (req, res) => {
    const { answermatch_prompt, answermatch_response, questiontext_id } = req.body;
    if (!answermatch_prompt || !answermatch_response || questiontext_id === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { data, error } = await supabase
      .from('answermatch_instrument')
      .insert([{
        answermatch_prompt,
        answermatch_response,
        questiontext_id: parseInt(questiontext_id)
      }])
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไข answermatch
  router.put('/answermatch/:answermatchId', async (req, res) => {
    const { answermatchId } = req.params;
    const { answermatch_prompt, answermatch_response } = req.body;
    if (!answermatch_prompt || !answermatch_response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { data, error } = await supabase
      .from('answermatch_instrument')
      .update({ answermatch_prompt, answermatch_response })
      .eq('answermatch_id', answermatchId)
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบ answermatch
  router.delete('/answermatch/:answermatchId', async (req, res) => {
    const { answermatchId } = req.params;
    const { error } = await supabase
      .from('answermatch_instrument')
      .delete()
      .eq('answermatch_id', answermatchId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Answermatch deleted' });
  });

  // GET: ดึงคำตอบทั้งหมดของคำถาม
  router.get('/questions/:questionId/answers', authenticateToken, requireAdmin, async (req, res) => {
    const { questionId } = req.params;
    const { data, error } = await supabase
      .from('answertext_instrument')
      .select('*')
      .eq('question_id', questionId)
      .order('answertext_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มคำตอบใหม่
  router.post('/answers', authenticateToken, requireAdmin, async (req, res) => {
    const { answer_text, is_correct, question_id } = req.body;
    if (!answer_text || question_id === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { data, error } = await supabase
      .from('answertext_instrument')
      .insert([{
        answer_text,
        is_correct: is_correct || false,
        question_id: parseInt(question_id)
      }])
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขคำตอบ
  router.put('/answers/:answerId', authenticateToken, requireAdmin, async (req, res) => {
    const { answerId } = req.params;
    const { answer_text, is_correct } = req.body;
    if (!answer_text) {
      return res.status(400).json({ error: 'Missing answer_text' });
    }
    const { data, error } = await supabase
      .from('answertext_instrument')
      .update({ answer_text, is_correct: is_correct || false })
      .eq('answertext_id', answerId)
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบคำตอบ
  router.delete('/answers/:answerId', authenticateToken, requireAdmin, async (req, res) => {
    const { answerId } = req.params;
    const { error } = await supabase
      .from('answertext_instrument')
      .delete()
      .eq('answertext_id', answerId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Answer deleted successfully' });
  });

  // PUT: ตั้งค่าคำตอบที่ถูกต้อง (ยกเลิกคำตอบอื่นๆ ที่ถูกต้องก่อน)
  router.put('/questions/:questionId/set-correct-answer/:answerId', authenticateToken, requireAdmin, async (req, res) => {
    const { questionId, answerId } = req.params;
    // 1. reset คำตอบอื่นๆ ให้ is_correct = false
    const { error: resetError } = await supabase
      .from('answertext_instrument')
      .update({ is_correct: false })
      .eq('question_id', questionId);
    if (resetError) {
      return res.status(500).json({ error: resetError.message });
    }
    // 2. ตั้งอันที่เลือกให้ is_correct = true
    const { data, error } = await supabase
      .from('answertext_instrument')
      .update({ is_correct: true })
      .eq('answertext_id', answerId)
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  return router;
}; 