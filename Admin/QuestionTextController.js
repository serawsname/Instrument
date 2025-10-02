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

  // GET: ดึงคำถามทั้งหมดของแบบทดสอบ (รองรับ endpoint ใหม่)
  router.get('/tests/:testId/questions', authenticateToken, requireAdmin, async (req, res) => {
    const { testId } = req.params;
    
    try {
      // ดึงข้อมูลแบบทดสอบก่อนเพื่อหาประเภท
      const { data: testData, error: testError } = await supabase
        .from('questiontext_instrument')
        .select(`
          questiontext_id,
          question_text,
          questiontype_id,
          pretest_id,
          posttest_id,
          leveltestone_id,
          leveltesttwo_id,
          leveltestthree_id,
          questiontype_instrument (
            questiontype_name
          ),
          pretest_instrument (
            pretest_name
          ),
          posttest_instrument (
            posttest_name
          ),
          leveltestone_instrument (
            leveltestone_name
          ),
          leveltesttwo_instrument (
            leveltwo_name
          ),
          leveltestthree_instrument (
            levelthree_name
          )
        `)
        .or(`pretest_id.eq.${testId},posttest_id.eq.${testId},leveltestone_id.eq.${testId},leveltesttwo_id.eq.${testId},leveltestthree_id.eq.${testId}`)
        .order('questiontext_id');

      if (testError) {
        console.error('Error fetching questions:', testError);
        return res.status(500).json({ error: testError.message });
      }

      res.json(testData);
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET: ดึงประเภทคำถามทั้งหมด
  router.get('/question-types', authenticateToken, requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('questiontype_instrument')
      .select('*')
      .order('questiontype_id');

    if (error) {
      console.error('Error fetching question types:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มประเภทคำถามใหม่
  router.post('/question-types', authenticateToken, requireAdmin, async (req, res) => {
    const { questiontype_name } = req.body;

    if (!questiontype_name) {
      return res.status(400).json({ error: 'Missing required field: questiontype_name' });
    }

    try {
      const { data, error } = await supabase
        .from('questiontype_instrument')
        .insert([{ questiontype_name }])
        .select('*');

      if (error) {
        console.error('Error inserting question type:', error);
        return res.status(500).json({ error: error.message });
      }
      res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error inserting question type:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT: แก้ไขประเภทคำถาม
  router.put('/question-types/:questionTypeId', authenticateToken, requireAdmin, async (req, res) => {
    const { questionTypeId } = req.params;
    const { questiontype_name } = req.body;

    if (!questiontype_name) {
      return res.status(400).json({ error: 'Missing required field: questiontype_name' });
    }

    try {
      const { data, error } = await supabase
        .from('questiontype_instrument')
        .update({ questiontype_name })
        .eq('questiontype_id', questionTypeId)
        .select('*');

      if (error) {
        console.error('Error updating question type:', error);
        return res.status(500).json({ error: error.message });
      }

      if (data.length === 0) {
        return res.status(404).json({ error: 'Question type not found' });
      }

      res.json(data[0]);
    } catch (error) {
      console.error('Error updating question type:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE: ลบประเภทคำถาม
  router.delete('/question-types/:questionTypeId', authenticateToken, requireAdmin, async (req, res) => {
    const { questionTypeId } = req.params;

    try {
      // ตรวจสอบว่ามีคำถามที่ใช้ประเภทนี้อยู่หรือไม่
      const { data: existingQuestions, error: checkError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id')
        .eq('questiontype_id', questionTypeId)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing questions:', checkError);
        return res.status(500).json({ error: checkError.message });
      }

      if (existingQuestions.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete question type because it is being used by existing questions' 
        });
      }

      const { error } = await supabase
        .from('questiontype_instrument')
        .delete()
        .eq('questiontype_id', questionTypeId);

      if (error) {
        console.error('Error deleting question type:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ message: 'Question type deleted successfully' });
    } catch (error) {
      console.error('Error deleting question type:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST: เพิ่มคำถามใหม่
  router.post('/questions', authenticateToken, requireAdmin, async (req, res) => {
    const { question_text, questiontype_id, test_id, test_type } = req.body;

    if (!question_text || !questiontype_id || !test_id || !test_type) {
      return res.status(400).json({ error: 'Missing required fields: question_text, questiontype_id, test_id, test_type' });
    }

    try {
      // สร้าง object สำหรับ insert โดยกำหนด foreign key ตาม test_type
      const insertData = {
        question_text,
        questiontype_id: parseInt(questiontype_id)
      };

      // กำหนด foreign key ตาม test_type
      switch (test_type) {
        case 'pretest':
          insertData.pretest_id = parseInt(test_id);
          break;
        case 'posttest':
          insertData.posttest_id = parseInt(test_id);
          break;
        case 'leveltestone':
          insertData.leveltestone_id = parseInt(test_id);
          break;
        case 'leveltesttwo':
          insertData.leveltesttwo_id = parseInt(test_id);
          break;
        case 'leveltestthree':
          insertData.leveltestthree_id = parseInt(test_id);
          break;
        default:
          return res.status(400).json({ error: 'Invalid test_type' });
      }

      const { data, error } = await supabase
        .from('questiontext_instrument')
        .insert([insertData])
        .select(`
          *,
          questiontype_instrument (
            questiontype_name
          )
        `);

      if (error) {
        console.error('Error inserting question:', error);
        return res.status(500).json({ error: error.message });
      }
      res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error inserting question:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT: แก้ไขคำถาม
  router.put('/questions/:questionId', authenticateToken, requireAdmin, async (req, res) => {
    const { questionId } = req.params;
    const { question_text, questiontype_id } = req.body;

    if (!question_text || !questiontype_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('questiontext_instrument')
      .update({
        question_text,
        questiontype_id: parseInt(questiontype_id)
      })
      .eq('questiontext_id', questionId)
      .select(`
        *,
        questiontype_instrument (
          questiontype_name
        )
      `);

    if (error) {
      console.error('Error updating question:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบคำถาม
  router.delete('/questions/:questionId', authenticateToken, requireAdmin, async (req, res) => {
    const { questionId } = req.params;

    const { error } = await supabase
      .from('questiontext_instrument')
      .delete()
      .eq('questiontext_id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Question deleted successfully' });
  });

  return router;
};