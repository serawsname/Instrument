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

      // กรองเฉพาะคำถามที่สมบูรณ์ (มีคำตอบหรือมีคู่ Matching อย่างน้อยหนึ่งรายการ)
      const questionIdsAll = questions.map(q => q.questiontext_id);
      const { data: mcAnswers, error: mcError } = await supabase
        .from('answertext_instrument')
        .select('answertext_id, question_id')
        .in('question_id', questionIdsAll);
      if (mcError) throw new Error(mcError.message);

      let matchingAnswers = [];
      {
        try {
          const { data: matchData, error: matchError } = await supabase
            .from('answermatch_instrument')
            .select('answermatch_id, questiontext_id')
            .in('questiontext_id', questionIdsAll);
          if (matchError) {
            const msg = matchError.message || '';
            if (!/relation .* does not exist/i.test(msg) && !/does not exist/i.test(msg)) {
              throw new Error(matchError.message);
            }
          } else {
            matchingAnswers = matchData || [];
          }
        } catch (e) {
          const msg = e.message || '';
          if (!/relation .* does not exist/i.test(msg) && !/does not exist/i.test(msg)) {
            throw e;
          }
        }
      }

      const questionsWithMc = new Set((mcAnswers || []).map(a => a.question_id));
      const questionsWithMatch = new Set((matchingAnswers || []).map(m => m.questiontext_id));
      const completeQuestions = questions.filter(q =>
        questionsWithMc.has(q.questiontext_id) || questionsWithMatch.has(q.questiontext_id)
      );

      if (completeQuestions.length === 0) {
        // ไม่มีคำถามที่สมบูรณ์ -> ไม่ต้องแจ้งเตือนแบบทดสอบใหม่
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: [],
            message: 'ไม่มีคำถามที่สมบูรณ์สำหรับ pretest ของเครื่องดนตรีนี้'
          }
        });
      }

      const pretestIdsWithCompleteQuestions = new Set(completeQuestions.map(q => q.pretest_id));
      const questionIds = completeQuestions.map(q => q.questiontext_id);
      // ตรวจสอบว่าผู้ใช้เคยตอบคำถามที่สมบูรณ์เหล่านี้แล้วหรือไม่
      const { data: userAnswers, error: answerError } = await supabase
        .from('user_answer')
        .select('question_id, is_correct')
        .eq('user_id', userId)
        .in('question_id', questionIds);

      if (answerError) throw new Error(answerError.message);
      // จัดกลุ่มคำถามตาม pretest_id เฉพาะคำถามที่สมบูรณ์
      const questionsByPretest = {};
      completeQuestions.forEach(question => {
        if (!questionsByPretest[question.pretest_id]) {
          questionsByPretest[question.pretest_id] = [];
        }
        questionsByPretest[question.pretest_id].push(question.questiontext_id);
      });

      // ตรวจสอบว่า pretest ไหนที่ทำครบแล้ว
      const completedPretestIds = new Set();
      
      for (const [pretestId, qIds] of Object.entries(questionsByPretest)) {
        const answeredQuestions = (userAnswers || []).filter(answer => 
          qIds.includes(answer.question_id)
        );
        
        // ถ้าตอบครบทุกคำถามใน pretest นี้
        if (answeredQuestions.length === qIds.length) {
          completedPretestIds.add(parseInt(pretestId));
        }
      }

      // กรองเฉพาะ pretest ที่มีคำถามสมบูรณ์ และยังไม่เคยทำครบ (แบบทดสอบใหม่)
      const newTests = pretests.filter(pretest => 
        pretestIdsWithCompleteQuestions.has(pretest.pretest_id) &&
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
      const pretestIds2 = pretests.map(p => p.pretest_id);
      // ดึงคำถามทั้งหมดของ pretest เหล่านี้
      const { data: questions2, error: questionError2 } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, pretest_id')
        .in('pretest_id', pretestIds2);

      if (questionError2) throw new Error(questionError2.message);
      if (questions2.length === 0) {
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

      // กรองเฉพาะคำถามที่สมบูรณ์ (มีคำตอบหรือมีคู่ Matching อย่างน้อยหนึ่งรายการ)
      const questionIdsAll2 = questions2.map(q => q.questiontext_id);
      const { data: mcAnswers2, error: mcError2 } = await supabase
        .from('answertext_instrument')
        .select('answertext_id, question_id')
        .in('question_id', questionIdsAll2);
      if (mcError2) throw new Error(mcError2.message);

      let matchingAnswers2 = [];
      {
        try {
          const { data: matchData2, error: matchError2 } = await supabase
            .from('answermatch_instrument')
            .select('answermatch_id, questiontext_id')
            .in('questiontext_id', questionIdsAll2);
          if (matchError2) {
            const msg2 = matchError2.message || '';
            if (!/relation .* does not exist/i.test(msg2) && !/does not exist/i.test(msg2)) {
              throw new Error(matchError2.message);
            }
          } else {
            matchingAnswers2 = matchData2 || [];
          }
        } catch (e) {
          const msg2 = e.message || '';
          if (!/relation .* does not exist/i.test(msg2) && !/does not exist/i.test(msg2)) {
            throw e;
          }
        }
      }

      const questionsWithMc2 = new Set((mcAnswers2 || []).map(a => a.question_id));
      const questionsWithMatch2 = new Set((matchingAnswers2 || []).map(m => m.questiontext_id));
      const completeQuestions2 = questions2.filter(q =>
        questionsWithMc2.has(q.questiontext_id) || questionsWithMatch2.has(q.questiontext_id)
      );

      if (completeQuestions2.length === 0) {
        return res.json({
          status: 'success',
          data: {
            hasNewTests: false,
            newTests: [],
            message: 'ไม่มีคำถามที่สมบูรณ์สำหรับ pretest ของเครื่องดนตรีนี้'
          }
        });
      }

      const pretestIdsWithCompleteQuestions2 = new Set(completeQuestions2.map(q => q.pretest_id));
      const questionIds2 = completeQuestions2.map(q => q.questiontext_id);
      // ตรวจสอบว่าผู้ใช้เคยตอบคำถามที่สมบูรณ์เหล่านี้แล้วหรือไม่
      const { data: userAnswers2, error: answerError2 } = await supabase
        .from('user_answer')
        .select('question_id, is_correct')
        .eq('user_id', userId)
        .in('question_id', questionIds2);

      if (answerError2) throw new Error(answerError2.message);
      // จัดกลุ่มคำถามตาม pretest_id เฉพาะคำถามที่สมบูรณ์
      const questionsByPretest2 = {};
      completeQuestions2.forEach(question => {
        if (!questionsByPretest2[question.pretest_id]) {
          questionsByPretest2[question.pretest_id] = [];
        }
        questionsByPretest2[question.pretest_id].push(question.questiontext_id);
      });

      // ตรวจสอบว่า pretest ไหนที่ทำครบแล้ว
      const completedPretestIds = new Set();
      
      for (const [pretestId, qIds] of Object.entries(questionsByPretest2)) {
        const answeredQuestions = (userAnswers2 || []).filter(answer => 
          qIds.includes(answer.question_id)
        );
        
        // ถ้าตอบครบทุกคำถามใน pretest นี้
        if (answeredQuestions.length === qIds.length) {
          completedPretestIds.add(parseInt(pretestId));
        }
      }

      // กรองเฉพาะ pretest ที่มีคำถามสมบูรณ์ และยังไม่เคยทำครบ (แบบทดสอบใหม่)
      const newTests2 = pretests.filter(pretest => 
        pretestIdsWithCompleteQuestions2.has(pretest.pretest_id) &&
        !completedPretestIds.has(pretest.pretest_id)
      );
      return res.json({
        status: 'success',
        data: {
          hasNewTests: newTests2.length > 0,
          newTests: newTests2,
          message: newTests2.length > 0 ? 'มีแบบทดสอบใหม่ที่คุณยังไม่เคยทำ' : 'ไม่มีแบบทดสอบใหม่'
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
