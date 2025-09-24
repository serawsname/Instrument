// File: Posttest/SubmitPosttest.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  router.post('/submit-posttest', authenticateToken, async (req, res) => {
    const { posttest_id, instrument_id, answers } = req.body;
    const user_id = req.user.sub; // ใช้ sub แทน user_id เพราะใน token เราใช้ sub: user.user_id
    if (!posttest_id || !instrument_id || !answers) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ posttest_id, instrument_id และ answers' 
      });
    }

    try {
      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับ posttest_id นี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, question_text')
        .eq('posttest_id', posttest_id);

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

      // สร้าง Map สำหรับคำตอบที่ถูกต้อง
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
      // แบบทดสอบหลังเรียนไม่ต้องมีเกณฑ์คะแนนผ่าน - ผ่านทันทีที่ทำเสร็จ
      const passed = true;
      // บันทึกคะแนนรวมลงในตาราง posttest_score
      const { data: existingScore, error: checkError } = await supabase
        .from('posttest_score')
        .select('score_id')
        .eq('user_id', user_id)
        .eq('posttest_id', posttest_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(checkError.message);
      }

      // คำนวณ level ของผู้ใช้หลังจากได้คะแนนใหม่
      const calculateUserLevel = async (userId, newScore) => {
        try {
          // ดึงคะแนนรวมทั้งหมดของผู้ใช้จาก posttest_score (รวมคะแนนใหม่)
          const { data: scores, error: scoreError } = await supabase
            .from('posttest_score')
            .select('score')
            .eq('user_id', userId);

          if (scoreError) {
            console.error('Error fetching user scores:', scoreError);
            return null;
          }

          // คำนวณคะแนนรวมทั้งหมด (รวมคะแนนใหม่)
          const currentTotalScore = scores.reduce((sum, record) => sum + record.score, 0);
          const totalScoreWithNew = currentTotalScore + newScore;

          // ดึงข้อมูล level ทั้งหมดเรียงตามคะแนนจากน้อยไปมาก
          const { data: levels, error: levelError } = await supabase
            .from('user_level')
            .select('level_id, level_name, score')
            .order('score', { ascending: true });

          if (levelError) {
            console.error('Error fetching user levels:', levelError);
            return null;
          }

          // หา level ที่เหมาะสมกับคะแนนของผู้ใช้
          let userLevel = null;
          for (const level of levels) {
            if (totalScoreWithNew >= level.score) {
              userLevel = level;
            } else {
              break;
            }
          }

          return userLevel;
        } catch (error) {
          console.error('Error calculating user level:', error);
          return null;
        }
      };

      // คำนวณ level ที่ผู้ใช้ควรได้รับ
      const userLevel = await calculateUserLevel(user_id, totalScore);
      const levelId = userLevel ? userLevel.level_id : null;
      const scoreData = {
        user_id: user_id,
        posttest_id: posttest_id,
        score: totalScore,
        level_id: levelId // บันทึก level_id ที่คำนวณได้
      };

      let scoreResult;
      if (existingScore) {
        // อัปเดตคะแนนที่มีอยู่แล้ว (รวม level_id)
        const { data: updateResult, error: updateError } = await supabase
          .from('posttest_score')
          .update({ 
            score: totalScore,
            level_id: levelId 
          })
          .eq('score_id', existingScore.score_id)
          .select();

        if (updateError) throw new Error(updateError.message);
        scoreResult = updateResult;
      } else {
        // เพิ่มคะแนนใหม่
        const { data: insertResult, error: insertError } = await supabase
          .from('posttest_score')
          .insert(scoreData)
          .select();

        if (insertError) throw new Error(insertError.message);
        scoreResult = insertResult;
      }
      res.status(200).json({
        status: 'success',
        message: 'ส่งคำตอบสำเร็จ',
        score: totalScore,
        total: totalQuestions,
        passed: passed,
        no_score_required: true, // บอกว่าไม่ต้องตรวจสอบคะแนน
        score_saved: true, // บอกว่าบันทึกคะแนนแล้ว
        score_record: scoreResult[0] // ข้อมูลการบันทึกคะแนน
      });

    } catch (error) {
      console.error('Error submitting posttest:', error.message);
      res.status(500).json({ status: 'error', message: 'ไม่สามารถส่งคำตอบได้: ' + error.message });
    }
  });

  return router;
};
