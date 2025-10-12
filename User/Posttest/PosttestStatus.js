// File: Posttest/PosttestStatus.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  // GET: ตรวจสอบสถานะการทำแบบทดสอบ posttest
  router.get('/posttest-status/:instrumentId', authenticateToken, async (req, res) => {
    const { instrumentId } = req.params;
    const userId = req.user.sub;

    if (!instrumentId || isNaN(instrumentId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ instrument ID ที่ถูกต้อง' 
      });
    }

    try {
      // ดึง posttest สำหรับ instrument นี้
      const { data: posttests, error: posttestError } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name,
          instrument_id
        `)
        .eq('instrument_id', parseInt(instrumentId));

      if (posttestError) throw new Error(posttestError.message);

      if (posttests.length === 0) {
        return res.json({
          status: 'success',
          data: {
            hasPosttest: false,
            alreadyCompleted: true,
            action: 'go_to_instrument',
            instrumentId: parseInt(instrumentId)
          }
        });
      }

      // ตรวจสอบว่าผู้ใช้เคยทำ posttest ไหนแล้วบ้าง
      const completedPosttestIds = new Set();
      const newPosttestIds = new Set();
      
      for (const posttest of posttests) {
        // ดึงคำถามทั้งหมดของ posttest นี้
        const { data: questions, error: questionError } = await supabase
          .from('questiontext_instrument')
          .select('questiontext_id')
          .eq('posttest_id', posttest.posttest_id);

        if (questionError) throw new Error(questionError.message);

        if (questions.length === 0) {
          // ไม่มีคำถามใน posttest นี้ - ถือว่าเป็น posttest ใหม่
          newPosttestIds.add(posttest.posttest_id);
          continue;
        }

        const questionIds = questions.map(q => q.questiontext_id);

        // ตรวจสอบว่าผู้ใช้เคยตอบคำถามเหล่านี้แล้วหรือไม่
        const { data: userAnswers, error: userAnswerError } = await supabase
          .from('user_answer')
          .select('question_id')
          .in('question_id', questionIds)
          .eq('user_id', userId);

        if (userAnswerError) throw new Error(userAnswerError.message);

        // ตรวจสอบว่าตอบครบทุกคำถามหรือไม่
        const answeredQuestionIds = userAnswers.map(ua => ua.question_id);
        const allQuestionsAnswered = questionIds.every(qId => 
          answeredQuestionIds.includes(qId)
        );

        if (allQuestionsAnswered) {
          completedPosttestIds.add(posttest.posttest_id);
        } else {
          newPosttestIds.add(posttest.posttest_id);
        }
      }

      // แยก posttest เป็น 2 กลุ่ม
      const completedPosttests = posttests.filter(p => completedPosttestIds.has(p.posttest_id));
      const newPosttests = posttests.filter(p => newPosttestIds.has(p.posttest_id));

      // กำหนด action ตามสถานการณ์
      if (completedPosttests.length === 0 && newPosttests.length === 0) {
        // ไม่มี posttest ทั้งหมด
        return res.json({
          status: 'success',
          data: {
            hasPosttest: false,
            alreadyCompleted: true,
            action: 'go_to_instrument',
            instrumentId: parseInt(instrumentId)
          }
        });
      } else if (completedPosttests.length === 0 && newPosttests.length > 0) {
        // ผู้ใช้ไม่เคยทำ posttest มาก่อน และมี posttest ใหม่
        if (newPosttests.length === 1) {
          // มี posttest ใหม่ 1 อัน - ไปทำเลย
          return res.json({
            status: 'success',
            data: {
              hasPosttest: true,
              alreadyCompleted: false,
              action: 'start_new_posttest',
              posttest: newPosttests[0],
              instrumentId: parseInt(instrumentId)
            }
          });
        } else {
          // มี posttest ใหม่หลายอัน - ให้เลือก
          return res.json({
            status: 'success',
            data: {
              hasPosttest: true,
              alreadyCompleted: false,
              action: 'show_posttest_selection',
              posttests: newPosttests,
              instrumentId: parseInt(instrumentId)
            }
          });
        }
      } else if (completedPosttests.length > 0 && newPosttests.length === 0) {
        // ผู้ใช้เคยทำ posttest แล้ว และไม่มี posttest ใหม่
        if (completedPosttests.length === 1) {
          // มี posttest ที่ทำแล้ว 1 อัน - ให้ทำซ้ำ
          return res.json({
            status: 'success',
            data: {
              hasPosttest: true,
              alreadyCompleted: true,
              action: 'retry_completed_posttest',
              posttest: completedPosttests[0],
              instrumentId: parseInt(instrumentId)
            }
          });
        } else {
          // มี posttest ที่ทำแล้วหลายอัน - ให้เลือก
          return res.json({
            status: 'success',
            data: {
              hasPosttest: true,
              alreadyCompleted: true,
              action: 'show_completed_posttest_selection',
              posttests: completedPosttests,
              instrumentId: parseInt(instrumentId)
            }
          });
        }
      } else {
        // มีทั้ง posttest ที่ทำแล้วและ posttest ใหม่
        return res.json({
          status: 'success',
          data: {
            hasPosttest: true,
            alreadyCompleted: true,
            action: 'show_choice_dialog',
            completedPosttests: completedPosttests,
            newPosttests: newPosttests,
            instrumentId: parseInt(instrumentId)
          }
        });
      }

    } catch (err) {
      console.error('❌ Unexpected server error in /posttest-status:', err.message);
      res.status(500).json({ 
        status: 'error', 
        message: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะแบบทดสอบหลังเรียน' 
      });
    }
  });

  return router;
};
