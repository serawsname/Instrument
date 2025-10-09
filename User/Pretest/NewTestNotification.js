// File: Pretest/NewTestNotification.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  // GET: ตรวจสอบแบบทดสอบใหม่ที่ยังไม่เคยทำ (สำหรับการทดสอบ - ไม่ต้องใช้ auth)
  router.get('/new-tests-test/:instrumentId', async (req, res) => {
    const { instrumentId } = req.params;
    const userId = 1; // ใช้ user ID 1 สำหรับการทดสอบ
    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ instrument ID ที่ถูกต้อง' 
      });
    }

    try {
      // ดึง pretest สำหรับ instrument นี้
      const { data: pretests, error: pretestError } = await supabase
        .from('pretest_instrument')
        .select(`
          pretest_id,
          pretest_name,
          instrument_id
        `)
        .eq('instrument_id', parseInt(instrumentId));

      if (pretestError) throw new Error(pretestError.message);
      if (pretests.length === 0) {
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: []
          }
        });
      }

      // ตรวจสอบว่าผู้ใช้เคยทำ pretest ไหนแล้วบ้าง
      const pretestIds = pretests.map(p => p.pretest_id);
      // ดึงคำถามทั้งหมดของ pretest เหล่านี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, pretest_id')
        .in('pretest_id', pretestIds);

      if (questionError) throw new Error(questionError.message);
      if (questions.length === 0) {
        // ไม่มีคำถามใน pretest เหล่านี้ -> ไม่ควรเด้ง popup ว่า "แบบทดสอบใหม่"
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: [],
            message: 'ไม่มีคำถามสำหรับ pretest ของเครื่องดนตรีนี้'
          }
        });
      }

      const questionIds = questions.map(q => q.questiontext_id);
      // ตรวจสอบว่าผู้ใช้เคยตอบคำถามเหล่านี้แล้วหรือไม่
      const { data: userAnswers, error: answerError } = await supabase
        .from('user_answer')
        .select('question_id, is_correct')
        .eq('user_id', userId)
        .in('question_id', questionIds);

      if (answerError) throw new Error(answerError.message);
      // จัดกลุ่มคำถามตาม pretest_id
      const questionsByPretest = {};
      questions.forEach(question => {
        if (!questionsByPretest[question.pretest_id]) {
          questionsByPretest[question.pretest_id] = [];
        }
        questionsByPretest[question.pretest_id].push(question.questiontext_id);
      });

      // ตรวจสอบว่า pretest ไหนที่ทำครบแล้ว
      const completedPretestIds = new Set();
      
      for (const [pretestId, questionIds] of Object.entries(questionsByPretest)) {
        const answeredQuestions = userAnswers.filter(answer => 
          questionIds.includes(answer.question_id)
        );
        
        // ถ้าตอบครบทุกคำถามใน pretest นี้
        if (answeredQuestions.length === questionIds.length) {
          completedPretestIds.add(parseInt(pretestId));
        }
      }

      // กรองเฉพาะ pretest ที่ยังไม่เคยทำ (แบบทดสอบใหม่)
      const newTests = pretests.filter(pretest => 
        !completedPretestIds.has(pretest.pretest_id)
      );
      return res.json({
        status: 'success',
        data: {
          hasNewTests: newTests.length > 0,
          newTests: newTests,
          message: newTests.length > 0 ? 'มีแบบทดสอบใหม่ที่คุณยังไม่เคยทำ' : 'ไม่มีแบบทดสอบใหม่'
        }
      });

    } catch (error) {
      console.error('Error checking new tests:', error);
      res.status(500).json({ 
        status: 'error', 
        message: `ไม่สามารถตรวจสอบแบบทดสอบใหม่ได้: ${error.message}` 
      });
    }
  });

  // GET: ตรวจสอบแบบทดสอบใหม่ที่ยังไม่เคยทำ (สำหรับใช้งานจริง - ต้องใช้ auth)
  router.get('/new-tests/:instrumentId', authenticateToken, async (req, res) => {
    const { instrumentId } = req.params;
    const userId = req.user.sub;
    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ instrument ID ที่ถูกต้อง' 
      });
    }

    try {
      // ดึง pretest สำหรับ instrument นี้
      const { data: pretests, error: pretestError } = await supabase
        .from('pretest_instrument')
        .select(`
          pretest_id,
          pretest_name,
          instrument_id
        `)
        .eq('instrument_id', parseInt(instrumentId));

      if (pretestError) throw new Error(pretestError.message);
      if (pretests.length === 0) {
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: []
          }
        });
      }

      // ตรวจสอบว่าผู้ใช้เคยทำ pretest ไหนแล้วบ้าง
      const pretestIds = pretests.map(p => p.pretest_id);
      // ดึงคำถามทั้งหมดของ pretest เหล่านี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, pretest_id')
        .in('pretest_id', pretestIds);

      if (questionError) throw new Error(questionError.message);
      if (questions.length === 0) {
        // ไม่มีคำถามใน pretest เหล่านี้ -> ไม่ควรเด้ง popup ว่า "แบบทดสอบใหม่"
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: [],
            message: 'ไม่มีคำถามสำหรับ pretest ของเครื่องดนตรีนี้'
          }
        });
      }

      const questionIds = questions.map(q => q.questiontext_id);
      // ตรวจสอบว่าผู้ใช้เคยตอบคำถามเหล่านี้แล้วหรือไม่
      const { data: userAnswers, error: answerError } = await supabase
        .from('user_answer')
        .select('question_id, is_correct')
        .eq('user_id', userId)
        .in('question_id', questionIds);

      if (answerError) throw new Error(answerError.message);
      // จัดกลุ่มคำถามตาม pretest_id
      const questionsByPretest = {};
      questions.forEach(question => {
        if (!questionsByPretest[question.pretest_id]) {
          questionsByPretest[question.pretest_id] = [];
        }
        questionsByPretest[question.pretest_id].push(question.questiontext_id);
      });

      // ตรวจสอบว่า pretest ไหนที่ทำครบแล้ว
      const completedPretestIds = new Set();
      
      for (const [pretestId, questionIds] of Object.entries(questionsByPretest)) {
        const answeredQuestions = userAnswers.filter(answer => 
          questionIds.includes(answer.question_id)
        );
        
        // ถ้าตอบครบทุกคำถามใน pretest นี้
        if (answeredQuestions.length === questionIds.length) {
          completedPretestIds.add(parseInt(pretestId));
        }
      }

      // กรองเฉพาะ pretest ที่ยังไม่เคยทำ (แบบทดสอบใหม่)
      const newTests = pretests.filter(pretest => 
        !completedPretestIds.has(pretest.pretest_id)
      );
      return res.json({
        status: 'success',
        data: {
          hasNewTests: newTests.length > 0,
          newTests: newTests,
          message: newTests.length > 0 ? 'มีแบบทดสอบใหม่ที่คุณยังไม่เคยทำ' : 'ไม่มีแบบทดสอบใหม่'
        }
      });

    } catch (error) {
      console.error('Error checking new tests:', error);
      res.status(500).json({ 
        status: 'error', 
        message: `ไม่สามารถตรวจสอบแบบทดสอบใหม่ได้: ${error.message}` 
      });
    }
  });

  return router;
};
