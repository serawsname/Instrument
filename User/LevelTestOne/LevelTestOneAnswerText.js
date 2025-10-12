// File: LevelTestOne/LevelTestOneAnswerText.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // GET: ดึงคำถามและคำตอบสำหรับ leveltestone
  router.get('/leveltestone-answertexts', async (req, res) => {
    const { instrument_id, leveltestone_id, user_id } = req.query;

    if (!instrument_id || !leveltestone_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ instrument_id และ leveltestone_id' 
      });
    }

    try {
      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับ leveltestone_id นี้
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select(`
          questiontext_id,
          question_text,
          questiontype_instrument (
            questiontype_id,
            questiontype_name
          )
        `)
        .eq('leveltestone_id', leveltestone_id)
        .order('questiontext_id');

      if (questionError) throw new Error(questionError.message);

      if (!questions || questions.length === 0) {
        return res.json({ status: 'success', data: [] });
      }

      const questionIds = questions.map(q => q.questiontext_id);

      // ดึงข้อมูล media, choice, และ matching ทั้งหมดในครั้งเดียว
      const [
        { data: media, error: mediaError },
        { data: mcAnswers, error: mcError },
        { data: matchingAnswers, error: matchingError }
      ] = await Promise.all([
        supabase.from('questionmedia_instrument').select('questionstext_id, questionmedia_image, questionmedia_audio').in('questionstext_id', questionIds),
        supabase.from('answertext_instrument').select('answertext_id, question_id, answer_text, is_correct').in('question_id', questionIds),
        supabase.from('answermatch_instrument').select('answermatch_id, questiontext_id, answermatch_prompt, answermatch_response').in('questiontext_id', questionIds)
      ]);

      if (mediaError) throw new Error(mediaError.message);
      if (mcError) throw new Error(mcError.message);
      if (matchingError) throw new Error(matchingError.message);

      // สร้าง Map สำหรับ media
      const mediaMap = new Map();
      media.forEach(item => {
        if (!mediaMap.has(item.questionstext_id)) mediaMap.set(item.questionstext_id, []);
        mediaMap.get(item.questionstext_id).push(item);
      });

      // รวมข้อมูลคำถามและคำตอบ
      const questionsWithAnswers = questions.map(question => {
        const questionType = question.questiontype_instrument?.questiontype_name || 'multiple_choice';
        const questionMedia = mediaMap.get(question.questiontext_id) || [];
        
        // ดึงคำตอบสำหรับคำถามนี้
        const answers = mcAnswers.filter(answer => 
          answer.question_id === question.questiontext_id
        ).map(answer => ({
          answertext_id: answer.answertext_id,
          answer_text: answer.answer_text,
          is_correct: answer.is_correct
        }));
        
        // ดึงคำตอบสำหรับคำถาม Matching
        const matches = matchingAnswers.filter(match => 
          match.questiontext_id === question.questiontext_id
        ).map(match => ({
          prompt: match.answermatch_prompt,
          response: match.answermatch_response
        }));
        
        return {
          questiontext_id: question.questiontext_id,
          question_text: question.question_text,
          question_type: question.questiontype_instrument,
          media: questionMedia,
          answers: answers,
          matches: matches
        };
      });

      let filteredQuestions = questionsWithAnswers.filter(q => {
        const hasAnswers = Array.isArray(q.answers) && q.answers.length > 0;
        const hasMatches = Array.isArray(q.matches) && q.matches.length > 0;
        return hasAnswers || hasMatches;
      });
      // กรองคำถามออกหากผู้ใช้เคยตอบแล้ว (เมื่อมี user_id)
      if (user_id) {
        const parsedUserId = parseInt(user_id);
        if (!isNaN(parsedUserId)) {
          const questionIds = questions.map(q => q.questiontext_id);
          const { data: userAnswers, error: userAnswerError } = await supabase
            .from('user_answer')
            .select('question_id')
            .in('question_id', questionIds)
            .eq('user_id', parsedUserId);
          if (userAnswerError) throw new Error(userAnswerError.message);
          const answeredIds = new Set((userAnswers || []).map(ua => ua.question_id));
          filteredQuestions = filteredQuestions.filter(q => !answeredIds.has(q.questiontext_id));
        }
      }

      res.json({ status: 'success', data: filteredQuestions });
    } catch (error) {
      console.error('Error fetching leveltestone questions:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
