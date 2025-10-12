// File: LevelTestThree/SubmitLevelTestThree.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  router.post('/submit-leveltestthree', authenticateToken, async (req, res) => {
    const { leveltestthree_id, lesson_id, answers } = req.body;
    const user_id = req.user.sub;
    if (!leveltestthree_id || !lesson_id || !answers) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ leveltestthree_id, lesson_id และ answers' 
      });
    }

    try {
      // หา instrument_id จาก lesson_id
      const { data: lessonRow, error: lessonError } = await supabase
        .from('lesson_instrument')
        .select('thaiinstrument_id')
        .eq('lesson_id', lesson_id)
        .single();

      if (lessonError) throw new Error(lessonError.message);
      const instrumentId = lessonRow?.thaiinstrument_id;
      if (!instrumentId && instrumentId !== 0) {
        return res.status(400).json({ status: 'error', message: 'ไม่พบ instrument_id สำหรับบทเรียนนี้' });
      }

      // ตรวจสอบว่าผู้ใช้เคยผ่านแบบทดสอบนี้แล้วหรือไม่
      const { data: existingUnlock, error: unlockCheckError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', parseInt(user_id))
        .eq('test_type', 'leveltestthree')
        .eq('test_id', leveltestthree_id)
        .eq('instrument_id', instrumentId)
        .single();

      if (unlockCheckError && unlockCheckError.code !== 'PGRST116') {
        throw new Error(unlockCheckError.message);
      }

      const hasEverPassed = !!existingUnlock;

      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับ leveltestthree_id นี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select('questiontext_id, question_text')
        .eq('leveltestthree_id', leveltestthree_id);

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
        const questionId = ans.question_id;
        if (!correctAnswersMap.has(questionId)) {
          correctAnswersMap.set(questionId, []);
        }
        correctAnswersMap.get(questionId).push(ans.answer_text);
      });
      correctMatchingAnswers.forEach(match => {
        const questionId = match.questiontext_id;
        if (!correctAnswersMap.has(questionId)) {
          correctAnswersMap.set(questionId, []);
        }
        correctAnswersMap.get(questionId).push({
          prompt: match.answermatch_prompt,
          response: match.answermatch_response
        });
      });

      // ดึงคะแนนผ่านเกณฑ์จากฐานข้อมูล
      const { data: testRequirement, error: requirementError } = await supabase
        .from('testrequirement_instrument')
        .select('passing_score')
        .eq('leveltestthree_id', leveltestthree_id)
        .single();

      if (requirementError) {
        console.warn('ไม่พบการตั้งค่าคะแนนผ่านเกณฑ์ ใช้ค่าเริ่มต้น 2 คะแนน');
      }

      // ถ้า passing_score เป็น null ให้ผ่านไปได้เลย (ไม่ต้องตรวจสอบคะแนน)
      const requiredScore = testRequirement?.passing_score;
      const shouldCheckScore = requiredScore !== null && requiredScore !== undefined;
      const scoreToCheck = requiredScore || 2; // ใช้เป็น fallback เมื่อไม่มีข้อมูล

      // บันทึกคำตอบของผู้ใช้
      const userAnswerRecords = [];
      
      for (const question of questions) {
        const questionIdStr = question.questiontext_id.toString();
        const userAnswer = answers[questionIdStr];
        const correctAnswer = correctAnswersMap.get(question.questiontext_id);

        let isCorrect = false;
        const correctAnswers = correctAnswersMap.get(question.questiontext_id);
        if (userAnswer && correctAnswers && correctAnswers.length > 0) {
          const normalize = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : s);
          const first = correctAnswers[0];
          // กรณีปรนัย (MC)
          if (typeof first === 'string') {
            const ua = userAnswer?.answer_text ?? userAnswer;
            isCorrect = correctAnswers.map(normalize).includes(normalize(ua));
          }
          // กรณีจับคู่ (Matching)
          else if (typeof first === 'object' && first !== null) {
            const matchPairEquals = (a, b) => (
              normalize(a.prompt) === normalize(b.prompt) &&
              normalize(a.response) === normalize(b.response)
            );
            if (Array.isArray(userAnswer)) {
              if (userAnswer.length === correctAnswers.length) {
                const remaining = [...correctAnswers];
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
              isCorrect = correctAnswers.some(caPair => matchPairEquals(userAnswer, caPair));
            }
          }
        }
        
        userAnswerRecords.push({
          user_id: parseInt(user_id),
          question_id: question.questiontext_id,
          selected_answer: userAnswer,
          is_correct: isCorrect,
          score: isCorrect ? 1 : 0
        });
      }
      // คำนวณคะแนนรวมจาก userAnswerRecords
      const finalScore = userAnswerRecords.reduce((sum, record) => sum + record.score, 0);
      
      // ถ้า passing_score เป็น null ให้ผ่านไปได้เลย
      const currentTestPassed = shouldCheckScore ? (finalScore >= scoreToCheck) : true;

      // กำหนดว่าผู้ใช้สามารถเข้าเรียนได้หรือไม่
      // ถ้าเคยผ่านแล้ว หรือ ผ่านการทดสอบครั้งนี้
      const canAccessLearning = hasEverPassed || currentTestPassed;

      // บันทึกผลการทดสอบ (ถ้าผ่านเกณฑ์และยังไม่เคยบันทึก)
      if (currentTestPassed && !hasEverPassed) {
        const { error: unlockError } = await supabase
          .from('user_unlock')
          .upsert({
            user_id: parseInt(user_id),
            test_type: 'leveltestthree',
            test_id: leveltestthree_id,
            instrument_id: instrumentId,
            unlocked_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,test_type,test_id'
          });

        if (unlockError) {
          console.error('Error saving user unlock:', unlockError);
        }
      }

      // บันทึกผลลัพธ์ลงในฐานข้อมูล
      const { error: saveError } = await supabase
        .from('user_answer')
        .upsert(userAnswerRecords, { onConflict: 'user_id,question_id' });

      if (saveError) {
        console.error('Database save error:', saveError);
        throw new Error(saveError.message);
      } else {
      }

      // ส่งผลลัพธ์กลับ
      const responseData = {
        status: 'success',
        data: {
          score: finalScore,
          total: questions.length,
          percentage: Math.round((finalScore / questions.length) * 100),
          passed: currentTestPassed,
          hasEverPassed: hasEverPassed,
          canAccessLearning: canAccessLearning,
          passing_score: shouldCheckScore ? scoreToCheck : null, // แสดง null ถ้าไม่ต้องตรวจสอบ
          no_score_required: !shouldCheckScore, // บอกว่าไม่ต้องตรวจสอบคะแนน
          navigation: canAccessLearning ? {
            action: 'go_to_learning',
            message: hasEverPassed 
              ? 'คุณสามารถเข้าเรียนได้เนื่องจากเคยผ่านแบบทดสอบนี้แล้ว' 
              : (!shouldCheckScore 
                  ? 'ยินดีด้วย! คุณผ่านแบบทดสอบแล้ว สามารถไปเรียนรู้ออนไลน์ได้' 
                  : 'ยินดีด้วย! คุณผ่านเกณฑ์แล้ว สามารถไปเรียนรู้ออนไลน์ได้'),
            route: '/learning'
          } : {
            action: 'retry_test',
            message: 'คุณยังไม่ผ่านเกณฑ์ กรุณาลองใหม่อีกครั้ง',
            route: '/leveltestthree'
          }
        }
      };

      res.json(responseData);

    } catch (error) {
      console.error('Error submitting leveltestthree:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
