// File: LevelTestThree/LevelTestThreeAnswerText.js

const express = require('express');
const router = express.Router();

module.exports = (supabase, authenticateToken) => {
  // GET: ดึงคำตอบสำหรับคำถาม leveltestthree
  router.get('/leveltestthree-answertext/:questionId', authenticateToken, async (req, res) => {
    const { questionId } = req.params;
    const userId = req.user.sub;

    if (!questionId || isNaN(questionId)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ question ID ที่ถูกต้อง' 
      });
    }

    try {
      // ดึงคำตอบสำหรับคำถามนี้
      const { data: answers, error: answerError } = await supabase
        .from('answertext_instrument')
        .select(`
          answertext_id,
          answer_text,
          is_correct
        `)
        .eq('question_id', parseInt(questionId))
        .order('answertext_id');

      if (answerError) throw new Error(answerError.message);

      res.json({
        status: 'success',
        data: answers || []
      });

    } catch (error) {
      console.error('Error fetching leveltestthree answer text:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });

  // GET: ดึงคำถามและคำตอบสำหรับ leveltestthree
  router.get('/leveltestthree-answertexts', async (req, res) => {
    const { lesson_id, leveltestthree_id, user_id } = req.query;

    if (!lesson_id || !leveltestthree_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ lesson_id และ leveltestthree_id' 
      });
    }

    try {
      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับ leveltestthree_id นี้
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
        .eq('leveltestthree_id', leveltestthree_id)
        .order('questiontext_id');

      if (questionError) throw new Error(questionError.message);

      if (!questions || questions.length === 0) {
        return res.json({ status: 'success', data: [] });
      }

      const questionIds = questions.map(q => q.questiontext_id);

      // ดึงข้อมูล media, choice, และ matching ทั้งหมดในครั้งเดียว
      const { data: mediaData, error: mediaError } = await supabase
        .from('questionmedia_instrument')
        .select('*')
        .in('questionstext_id', questionIds);

      if (mediaError) throw new Error(mediaError.message);

      const { data: mcAnswers, error: mcError } = await supabase
        .from('answertext_instrument')
        .select('*')
        .in('question_id', questionIds);

      if (mcError) throw new Error(mcError.message);

      const { data: matchingAnswers, error: matchingError } = await supabase
        .from('answermatch_instrument')
        .select('*')
        .in('questiontext_id', questionIds);

      if (matchingError) throw new Error(matchingError.message);

      // สร้าง Map สำหรับ media
      const mediaMap = new Map();
      questionIds.forEach(id => mediaMap.set(id, []));
      mediaData.forEach(item => {
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
      // ถ้ามี user_id ให้กรองคำถามที่ผู้ใช้คนนั้นยังไม่ตอบ
      if (user_id) {
        const parsedUserId = parseInt(user_id);
        if (!isNaN(parsedUserId)) {
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
      console.error('Error fetching leveltestthree questions:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};
