// File: Pretest/AnswerText.js

const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  router.get('/answertexts', async (req, res) => {
    const { instrument_id, pretest_id, user_id } = req.query;

    if (!instrument_id || !pretest_id) {
      return res.status(400).json({ status: 'error', message: 'กรุณาระบุ instrument_id และ pretest_id' });
    }

    try {
      const parsedInstrumentId = Number(instrument_id);
      const parsedPretestId = Number(pretest_id);

      // ตรวจสอบว่า pretest_id ที่ส่งมานั้นถูกต้องและอยู่ใน instrument ที่ระบุ
      const { data: pretests, error: pretestError } = await supabase
        .from('pretest_instrument')
        .select('pretest_id')
        .eq('instrument_id', parsedInstrumentId)
        .eq('pretest_id', parsedPretestId);

      if (pretestError) throw new Error(`Supabase Error (pretest lookup): ${pretestError.message}`);
      if (!pretests || pretests.length === 0) {
        return res.status(404).json({ status: 'error', message: 'ไม่พบแบบทดสอบก่อนเรียนที่เชื่อมกับ instrument นี้' });
      }

      const pretestIds = pretests.map(p => p.pretest_id);

      // ดึงข้อมูลคำถามพร้อมกับประเภทคำถาม
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select(`
          questiontext_id,
          question_text,
          pretest_id,
          questiontype_instrument (
            questiontype_id,
            questiontype_name
          )
        `)
        .in('pretest_id', pretestIds);

      if (questionError) throw new Error(`Supabase Error (questions): ${questionError.message}`);
      if (!questions || questions.length === 0) {
        return res.status(404).json({ status: 'error', message: 'ไม่พบคำถามสำหรับ instrument นี้' });
      }

      const questionIds = questions.map(q => q.questiontext_id);

      // ดึงข้อมูล media, choice, และ matching ทั้งหมดในครั้งเดียว
      const [
        { data: media, error: mediaError },
        { data: answers, error: answerError },
        { data: matches, error: matchError }
      ] = await Promise.all([
        supabase.from('questionmedia_instrument').select('questionstext_id, questionmedia_image, questionmedia_audio').in('questionstext_id', questionIds),
        supabase.from('answertext_instrument').select('question_id, answer_text, is_correct').in('question_id', questionIds),
        supabase.from('answermatch_instrument').select('questiontext_id, answermatch_prompt, answermatch_response').in('questiontext_id', questionIds)
      ]);

      if (mediaError) throw new Error(`Supabase Error (media): ${mediaError.message}`);
      if (answerError) throw new Error(`Supabase Error (answers): ${answerError.message}`);
      if (matchError) throw new Error(`Supabase Error (matches): ${matchError.message}`);
      
      // แก้ไขตรงนี้: mediaMap เป็น array
      const mediaMap = new Map();
      media.forEach(item => {
        if (!mediaMap.has(item.questionstext_id)) mediaMap.set(item.questionstext_id, []);
        mediaMap.get(item.questionstext_id).push(item);
      });

      const answersMap = new Map();
      answers.forEach(a => {
        if (!answersMap.has(a.question_id)) answersMap.set(a.question_id, []);
        answersMap.get(a.question_id).push({
          answer_text: a.answer_text,
          is_correct: a.is_correct
        });
      });

      const matchesMap = new Map();
      matches.forEach(m => {
        if (!matchesMap.has(m.questiontext_id)) matchesMap.set(m.questiontext_id, []);
        matchesMap.get(m.questiontext_id).push({
          prompt: m.answermatch_prompt,
          response: m.answermatch_response
        });
      });

      // รวมข้อมูลคำถามกับคำตอบ
      const questionsWithAnswers = questions.map(question => {
        const questionMedia = mediaMap.get(question.questiontext_id) || [];
        const questionAnswers = answersMap.get(question.questiontext_id) || [];
        const questionMatches = matchesMap.get(question.questiontext_id) || [];

        return {
          questiontext_id: question.questiontext_id,
          question_text: question.question_text,
          question_type: question.questiontype_instrument,
          media: questionMedia,
          answers: questionAnswers,
          matches: questionMatches
        };
      });

      const filteredQuestions = questionsWithAnswers.filter(q => {
        const hasAnswers = Array.isArray(q.answers) && q.answers.length > 0;
        const hasMatches = Array.isArray(q.matches) && q.matches.length > 0;
        return hasAnswers || hasMatches;
      });

      // กรองให้แสดงเฉพาะคำถามที่ "ผู้ใช้ยังไม่เคยตอบ"
      let resultQuestions = filteredQuestions;
      const parsedUserId = Number(user_id);
      if (Number.isFinite(parsedUserId)) {
        const ids = filteredQuestions.map(q => q.questiontext_id);
        if (ids.length > 0) {
          const { data: userAnswers, error: userAnsError } = await supabase
            .from('user_answer')
            .select('question_id')
            .eq('user_id', parsedUserId)
            .in('question_id', ids);
          if (userAnsError) throw new Error(`Supabase Error (user_answer): ${userAnsError.message}`);
          const answeredSet = new Set((userAnswers || []).map(a => a.question_id));
          resultQuestions = filteredQuestions.filter(q => !answeredSet.has(q.questiontext_id));
        }
      }

      res.json({
        status: 'success',
        data: resultQuestions
      });

    } catch (error) {
      console.error('Error in pretest answertexts:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  return router;
};