// File: Pretest/SubmitPretest.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  router.post('/submit-pretest', authenticateToken, async (req, res) => {
    const { pretest_id, instrument_id, answers } = req.body;
    const user_id = req.user.sub; // ใช้ sub แทน user_id เพราะใน token เราใช้ sub: user.user_id
    if (!pretest_id || !instrument_id || !answers) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ pretest_id, instrument_id และ answers' 
      });
    }

    try {
      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับ pretest_id นี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, question_text')
        .eq('pretest_id', pretest_id);

      if (questionError) throw new Error(questionError.message);

      const questionIds = questions.map(q => q.questiontext_id);

      // ดึงคำตอบที่ถูกต้องสำหรับคำถาม Multiple Choice
      const { data: correctMcAnswers, error: mcError } = await supabase
        .from('answertext_instrument')
        .select('question_id, answer_text')
        .in('question_id', questionIds)
        .eq('is_correct', true);

      if (mcError) throw new Error(mcError.message);

      // ดึงคำตอบที่ถูกต้องสำหรับคำถาม Matching
      const { data: correctMatchingAnswers, error: matchingError } = await supabase
        .from('answermatch_instrument')
        .select('questiontext_id, answermatch_prompt, answermatch_response')
        .in('questiontext_id', questionIds);

      if (matchingError) throw new Error(matchingError.message);

      const correctAnswersMap = new Map();
      correctMcAnswers.forEach(ans => {
        // เก็บคำตอบที่ถูกต้องเป็น array สำหรับคำถามที่มีคำตอบถูกหลายข้อ
        if (correctAnswersMap.has(ans.question_id)) {
          const existingAnswers = correctAnswersMap.get(ans.question_id);
          if (Array.isArray(existingAnswers)) {
            existingAnswers.push(ans.answer_text);
          } else {
            correctAnswersMap.set(ans.question_id, [existingAnswers, ans.answer_text]);
          }
        } else {
          correctAnswersMap.set(ans.question_id, ans.answer_text); // เก็บเป็น string สำหรับ MC ที่มีคำตอบถูกข้อเดียว
        }
      });
      correctMatchingAnswers.forEach(match => {
        correctAnswersMap.set(match.questiontext_id, { // เก็บเป็น object สำหรับ Matching
          prompt: match.answermatch_prompt,
          response: match.answermatch_response
        });
      });
      let score = 0;
      const totalQuestions = questions.length;
      const userAnswerRecords = [];
      
      for (const question of questions) {
        const questionIdStr = question.questiontext_id.toString();
        const userAnswer = answers[questionIdStr]; // นี่คือคำตอบที่ผู้ใช้เลือก (อาจเป็น string หรือ object)
        const correctAnswer = correctAnswersMap.get(question.questiontext_id); // นี่คือคำตอบที่ถูกต้อง (อาจเป็น string หรือ object)
        let isCorrect = false;
        if (userAnswer && correctAnswer) {
          // ตรวจสอบว่าเป็นคำถามแบบปรนัย
          if (typeof correctAnswer === 'string') {
            // เปรียบเทียบ answer_text ของ userAnswer กับ correctAnswer
            isCorrect = userAnswer.answer_text === correctAnswer;
          }
          // ตรวจสอบว่าเป็นคำถามแบบปรนัยที่มีคำตอบถูกหลายข้อ
          else if (Array.isArray(correctAnswer)) {
            // ตรวจสอบว่า userAnswer.answer_text อยู่ใน array ของคำตอบที่ถูกต้องหรือไม่
            isCorrect = correctAnswer.includes(userAnswer.answer_text);
          }
          // ตรวจสอบว่าเป็นคำถามแบบจับคู่ (correctAnswer เป็น object)
          else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
            // ตรวจสอบว่า userAnswer มีโครงสร้างที่ถูกต้องสำหรับ matching หรือไม่
            if (userAnswer.prompt && userAnswer.response) {
              isCorrect = userAnswer.prompt === correctAnswer.prompt && 
                          userAnswer.response === correctAnswer.response;
            }
          }
        }
        userAnswerRecords.push({
          user_id: user_id,
          question_id: question.questiontext_id,
          selected_answer: userAnswer, // เก็บคำตอบที่ผู้ใช้เลือกทั้งหมดเป็น JSONB
          is_correct: isCorrect,
          score: isCorrect ? 1 : 0
        });
      }

      // บันทึกผลลัพธ์ลงในฐานข้อมูล
      // ต้องบันทึกทีละคำถามตามโครงสร้างตาราง user_answer
      const { error: saveError } = await supabase
        .from('user_answer')
        .upsert(userAnswerRecords, { onConflict: 'user_id,question_id' }); // ใช้ upsert เพื่ออัปเดตถ้ามีอยู่แล้ว

      if (saveError) throw new Error(saveError.message);

      // คำนวณคะแนนรวม
      const totalScore = userAnswerRecords.reduce((sum, record) => sum + record.score, 0);
      const passed = totalScore >= (totalQuestions * 0.7); // ผ่าน 70%
      // ไม่ต้องบันทึกคะแนนลงใน user_pretest_score แล้ว
      // ใช้เฉพาะ user_answer เพื่อตรวจสอบสถานะการทำ pretest

      res.status(200).json({
        status: 'success',
        message: 'ส่งคำตอบสำเร็จ',
        score: totalScore,
        total: totalQuestions,
        passed: passed
      });

    } catch (error) {
      console.error('Error submitting pretest:', error.message);
      res.status(500).json({ status: 'error', message: 'ไม่สามารถส่งคำตอบได้: ' + error.message });
    }
  });

  return router;
};
