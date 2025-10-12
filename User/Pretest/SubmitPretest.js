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
      // จัดเก็บคำตอบปรนัยเป็น array (รองรับหลายคำตอบถูก) หรือ string เมื่อมีเพียงข้อเดียว
      correctMcAnswers.forEach(ans => {
        const qid = ans.question_id;
        if (!correctAnswersMap.has(qid)) {
          correctAnswersMap.set(qid, []);
        }
        const arr = correctAnswersMap.get(qid);
        if (Array.isArray(arr)) {
          arr.push(ans.answer_text);
        } else {
          // กรณี map เคยถูกตั้งเป็นค่าอื่น ให้ปรับให้เป็น array
          correctAnswersMap.set(qid, [arr, ans.answer_text]);
        }
      });
      // จัดเก็บคำตอบจับคู่เป็น array ของ {prompt, response}
      correctMatchingAnswers.forEach(match => {
        const qid = match.questiontext_id;
        if (!correctAnswersMap.has(qid)) {
          correctAnswersMap.set(qid, []);
        }
        const arr = correctAnswersMap.get(qid);
        const pair = {
          prompt: match.answermatch_prompt,
          response: match.answermatch_response
        };
        if (Array.isArray(arr)) {
          arr.push(pair);
        } else {
          correctAnswersMap.set(qid, [arr, pair]);
        }
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
          const normalize = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : s);
          // กรณีคำตอบถูกต้องเป็น string (MC มีคำตอบเดียว)
          if (typeof correctAnswer === 'string') {
            const ua = userAnswer?.answer_text ?? userAnswer;
            isCorrect = normalize(ua) === normalize(correctAnswer);
          }
          // กรณีคำตอบถูกต้องเป็น array (อาจเป็น MC หลายข้อ หรือ Matching หลายคู่)
          else if (Array.isArray(correctAnswer)) {
            // ตรวจสอบประเภทของสมาชิกใน array
            const first = correctAnswer[0];
            // MC หลายข้อ: สมาชิกเป็น string
            if (typeof first === 'string') {
              const ua = userAnswer?.answer_text ?? userAnswer;
              isCorrect = correctAnswer.map(normalize).includes(normalize(ua));
            } else if (typeof first === 'object' && first !== null) {
              // Matching หลายคู่
              const matchPairEquals = (a, b) => (
                normalize(a.prompt) === normalize(b.prompt) &&
                normalize(a.response) === normalize(b.response)
              );
              if (Array.isArray(userAnswer)) {
                // ต้องถูกทุกคู่ (โดยไม่สนใจลำดับ)
                if (userAnswer.length === correctAnswer.length) {
                  const remaining = [...correctAnswer];
                  isCorrect = userAnswer.every(uaPair => {
                    const idx = remaining.findIndex(caPair => matchPairEquals(uaPair, caPair));
                    if (idx >= 0) {
                      remaining.splice(idx, 1);
                      return true;
                    }
                    return false;
                  });
                } else {
                  isCorrect = false;
                }
              } else if (typeof userAnswer === 'object' && userAnswer !== null) {
                // ผู้ใช้ส่งมาเป็นคู่เดียว: ถือว่าถูกถ้าตรงกับหนึ่งในคู่ที่ถูกต้อง
                isCorrect = correctAnswer.some(caPair => matchPairEquals(userAnswer, caPair));
              }
            }
          }
          // กรณีคำตอบถูกต้องเป็น object (Matching เดี่ยว)
          else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
            if (userAnswer && userAnswer.prompt && userAnswer.response) {
              isCorrect = normalize(userAnswer.prompt) === normalize(correctAnswer.prompt) &&
                          normalize(userAnswer.response) === normalize(correctAnswer.response);
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
