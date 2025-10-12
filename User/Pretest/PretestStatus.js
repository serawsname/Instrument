// File: Pretest/PretestStatus.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  // GET: ตรวจสอบสถานะการทำแบบทดสอบ pretest
  router.get('/pretest-status/:instrumentId', authenticateToken, async (req, res) => {
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
            hasPretest: false,
            alreadyCompleted: true,
            action: 'go_to_instrument',
            instrumentId: parseInt(instrumentId)
          }
        });
      }

      // ตรวจสอบว่าผู้ใช้เคยทำ pretest ไหนแล้วบ้าง โดยดูจาก user_answer
      const pretestIds = pretests.map(p => p.pretest_id);
      
      // ดึงคำถามทั้งหมดของ pretest เหล่านี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, pretest_id')
        .in('pretest_id', pretestIds);

      if (questionError) throw new Error(questionError.message);

      if (questions.length === 0) {
        // ไม่มีคำถามใน pretest เหล่านี้
        return res.json({
          status: 'success',
          data: {
            hasPretest: true,
            alreadyCompleted: false,
            availablePretests: pretests,
            message: 'มีแบบทดสอบใหม่ที่คุณยังไม่เคยทำ',
            action: 'show_available_pretests'
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

      // กรองเฉพาะ pretest ที่ยังไม่เคยทำ
      const availablePretests = pretests.filter(pretest => 
        !completedPretestIds.has(pretest.pretest_id)
      );



      if (availablePretests.length === 0) {
        // ผู้ใช้ทำ pretest ทั้งหมดแล้ว - เด้งเข้าหน้าเครื่องดนตรีเลย
        const response = {
          status: 'success',
          data: {
            hasPretest: true,
            alreadyCompleted: true,
            action: 'go_to_instrument', // เด้งเข้าหน้าเครื่องดนตรีเลย
            instrumentId: parseInt(instrumentId)
          }
        };

        return res.json(response);
      } else {
        // มี pretest ที่ยังไม่เคยทำ

        const response = {
          status: 'success',
          data: {
            hasPretest: true,
            alreadyCompleted: false,
            availablePretests: availablePretests,
            message: 'มีแบบทดสอบใหม่ที่คุณยังไม่เคยทำ',
            action: 'show_available_pretests'
          }
        };

        return res.json(response);
      }

    } catch (error) {
      console.error('Error checking pretest status:', error);
      res.status(500).json({ 
        status: 'error', 
        message: `ไม่สามารถตรวจสอบสถานะได้: ${error.message}` 
      });
    }
  });

  return router;
};
