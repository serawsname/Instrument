const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // GET: ดึง user_answer ทั้งหมด
  router.get('/user-answers', async (req, res) => {
    try {
      // ดึงข้อมูล user_answer ทั้งหมดก่อน
      const { data: userAnswers, error: userAnswerError } = await supabase
        .from('user_answer')
        .select('*')
        .order('answered_at', { ascending: false });
      
      if (userAnswerError) {
        console.error('Error fetching user answers:', userAnswerError);
        return res.status(500).json({ error: userAnswerError.message });
      }

      if (!userAnswers || userAnswers.length === 0) {
        return res.json([]);
      }

      // ดึงข้อมูล user ที่เกี่ยวข้อง
      const userIds = [...new Set(userAnswers.map(answer => answer.user_id))];
      const { data: users, error: userError } = await supabase
        .from('user')
        .select('user_id, username')
        .in('user_id', userIds);

      if (userError) {
        console.error('Error fetching users:', userError);
        return res.status(500).json({ error: userError.message });
      }

      // ดึงข้อมูล questiontext_instrument พร้อมข้อมูลแบบทดสอบและประเภทคำถาม
      const questionIds = [...new Set(userAnswers.map(answer => answer.question_id))];
      const { data: questions, error: questionError } = await supabase
        .from('questiontext_instrument')
        .select(`
          questiontext_id, 
          question_text,
          questiontype_id,
          pretest_id,
          posttest_id,
          leveltestone_id,
          leveltesttwo_id,
          leveltestthree_id,
          questiontype_instrument (
            questiontype_name
          )
        `)
        .in('questiontext_id', questionIds);

      if (questionError) {
        console.error('Error fetching questions:', questionError);
        return res.status(500).json({ error: questionError.message });
      }

      // ดึงข้อมูลแบบทดสอบแต่ละประเภท
      const pretestIds = [...new Set(questions?.filter(q => q.pretest_id).map(q => q.pretest_id) || [])];
      const posttestIds = [...new Set(questions?.filter(q => q.posttest_id).map(q => q.posttest_id) || [])];
      const leveltestoneIds = [...new Set(questions?.filter(q => q.leveltestone_id).map(q => q.leveltestone_id) || [])];
      const leveltesttwoIds = [...new Set(questions?.filter(q => q.leveltesttwo_id).map(q => q.leveltesttwo_id) || [])];
      const leveltestthreeIds = [...new Set(questions?.filter(q => q.leveltestthree_id).map(q => q.leveltestthree_id) || [])];

      // ดึงข้อมูลชื่อแบบทดสอบ และข้อมูลเครื่องดนตรี/บทเรียน
      const [pretestData, posttestData, leveltestoneData, leveltesttwoData, leveltestthreeData] = await Promise.all([
        pretestIds.length > 0 ? supabase.from('pretest_instrument').select('pretest_id, pretest_name, instrument_id').in('pretest_id', pretestIds) : { data: [] },
        posttestIds.length > 0 ? supabase.from('posttest_instrument').select('posttest_id, posttest_name, instrument_id').in('posttest_id', posttestIds) : { data: [] },
        leveltestoneIds.length > 0 ? supabase.from('leveltestone_instrument').select('leveltestone_id, leveltestone_name, thaiinstrument_id').in('leveltestone_id', leveltestoneIds) : { data: [] },
        leveltesttwoIds.length > 0 ? supabase.from('leveltesttwo_instrument').select('leveltesttwo_id, leveltwo_name, lesson_id').in('leveltesttwo_id', leveltesttwoIds) : { data: [] },
        leveltestthreeIds.length > 0 ? supabase.from('leveltestthree_instrument').select('leveltestthree_id, levelthree_name, lesson_id').in('leveltestthree_id', leveltestthreeIds) : { data: [] }
      ]);

      // รวบรวม instrument_id และ lesson_id จากข้อมูลที่ได้
      const instrumentIds = [
        ...new Set([
          ...(pretestData.data || []).map(p => p.instrument_id),
          ...(posttestData.data || []).map(p => p.instrument_id),
          ...(leveltestoneData.data || []).map(l => l.thaiinstrument_id)
        ].filter(id => id))
      ];

      const lessonIds = [
        ...new Set([
          ...(leveltesttwoData.data || []).map(l => l.lesson_id),
          ...(leveltestthreeData.data || []).map(l => l.lesson_id)
        ].filter(id => id))
      ];

      // ดึงข้อมูลเครื่องดนตรีและบทเรียน
      const [thaiInstrumentData, lessonData] = await Promise.all([
        instrumentIds.length > 0 ? supabase.from('thai_instrument').select('thaiinstrument_id, thaiinstrument_name').in('thaiinstrument_id', instrumentIds) : { data: [] },
        lessonIds.length > 0 ? supabase.from('lesson_instrument').select('lesson_id, lesson_name, thaiinstrument_id').in('lesson_id', lessonIds) : { data: [] }
      ]);

      // สร้าง Map สำหรับ lookup
      const userMap = new Map(users?.map(user => [user.user_id, user]) || []);
      const questionMap = new Map(questions?.map(q => [q.questiontext_id, q]) || []);
      const pretestMap = new Map(pretestData.data?.map(p => [p.pretest_id, p.pretest_name]) || []);
      const posttestMap = new Map(posttestData.data?.map(p => [p.posttest_id, p.posttest_name]) || []);
      const leveltestoneMap = new Map(leveltestoneData.data?.map(p => [p.leveltestone_id, p.leveltestone_name]) || []);
      const leveltesttwoMap = new Map(leveltesttwoData.data?.map(p => [p.leveltesttwo_id, p.leveltwo_name]) || []);
      const leveltestthreeMap = new Map(leveltestthreeData.data?.map(p => [p.leveltestthree_id, p.levelthree_name]) || []);
      const thaiInstrumentMap = new Map(thaiInstrumentData.data?.map(t => [t.thaiinstrument_id, t.thaiinstrument_name]) || []);
      const lessonMap = new Map(lessonData.data?.map(l => [l.lesson_id, l.lesson_name]) || []);

      // ฟังก์ชันสำหรับจัดรูปแบบคำตอบ
      const formatSelectedAnswer = (selectedAnswer) => {
        if (!selectedAnswer) return 'ไม่มีคำตอบ';
        
        if (typeof selectedAnswer === 'string') {
          try {
            const parsed = JSON.parse(selectedAnswer);
            return formatSelectedAnswer(parsed);
          } catch {
            return selectedAnswer;
          }
        }
        
        if (typeof selectedAnswer === 'object') {
          if (selectedAnswer.answer_text) {
            return selectedAnswer.answer_text;
          }
          if (selectedAnswer.prompt && selectedAnswer.response) {
            return `${selectedAnswer.prompt} → ${selectedAnswer.response}`;
          }
          return JSON.stringify(selectedAnswer, null, 2);
        }
        
        return String(selectedAnswer);
      };

      // รวมข้อมูลทั้งหมด
      const result = userAnswers.map(answer => {
        const question = questionMap.get(answer.question_id);
        let testType = 'ไม่ระบุ';
        let testName = 'ไม่ระบุ';

        if (question) {
          if (question.pretest_id) {
            testType = 'แบบทดสอบก่อนเรียน';
            testName = pretestMap.get(question.pretest_id) || 'ไม่ระบุชื่อ';
          } else if (question.posttest_id) {
            testType = 'แบบทดสอบหลังเรียน';
            testName = posttestMap.get(question.posttest_id) || 'ไม่ระบุชื่อ';
          } else if (question.leveltestone_id) {
            testType = 'แบบทดสอบระดับ 1';
            testName = leveltestoneMap.get(question.leveltestone_id) || 'ไม่ระบุชื่อ';
          } else if (question.leveltesttwo_id) {
            testType = 'แบบทดสอบระดับ 2';
            testName = leveltesttwoMap.get(question.leveltesttwo_id) || 'ไม่ระบุชื่อ';
          } else if (question.leveltestthree_id) {
            testType = 'แบบทดสอบระดับ 3';
            testName = leveltestthreeMap.get(question.leveltestthree_id) || 'ไม่ระบุชื่อ';
          }
        }

        // หาข้อมูลเครื่องดนตรีและบทเรียนจากแบบทดสอบ
        let thaiInstrumentName = null;
        let lessonName = null;

        if (question) {
          if (question.pretest_id) {
            const pretest = pretestData.data?.find(p => p.pretest_id === question.pretest_id);
            if (pretest?.instrument_id) {
              thaiInstrumentName = thaiInstrumentMap.get(pretest.instrument_id) || 'ไม่ระบุ';
            }
          } else if (question.posttest_id) {
            const posttest = posttestData.data?.find(p => p.posttest_id === question.posttest_id);
            if (posttest?.instrument_id) {
              thaiInstrumentName = thaiInstrumentMap.get(posttest.instrument_id) || 'ไม่ระบุ';
            }
          } else if (question.leveltestone_id) {
            const leveltest = leveltestoneData.data?.find(l => l.leveltestone_id === question.leveltestone_id);
            if (leveltest?.thaiinstrument_id) {
              thaiInstrumentName = thaiInstrumentMap.get(leveltest.thaiinstrument_id) || 'ไม่ระบุ';
            }
          } else if (question.leveltesttwo_id) {
            const leveltest = leveltesttwoData.data?.find(l => l.leveltesttwo_id === question.leveltesttwo_id);
            if (leveltest?.lesson_id) {
              const lesson = lessonData.data?.find(l => l.lesson_id === leveltest.lesson_id);
              lessonName = lesson?.lesson_name || 'ไม่ระบุ';
              if (lesson?.thaiinstrument_id) {
                thaiInstrumentName = thaiInstrumentMap.get(lesson.thaiinstrument_id) || 'ไม่ระบุ';
              }
            }
          } else if (question.leveltestthree_id) {
            const leveltest = leveltestthreeData.data?.find(l => l.leveltestthree_id === question.leveltestthree_id);
            if (leveltest?.lesson_id) {
              const lesson = lessonData.data?.find(l => l.lesson_id === leveltest.lesson_id);
              lessonName = lesson?.lesson_name || 'ไม่ระบุ';
              if (lesson?.thaiinstrument_id) {
                thaiInstrumentName = thaiInstrumentMap.get(lesson.thaiinstrument_id) || 'ไม่ระบุ';
              }
            }
          }
        }

        return {
          ...answer,
          username: userMap.get(answer.user_id)?.username || null,
          question_text: question?.question_text || null,
          question_type: question?.questiontype_instrument?.questiontype_name || 'ไม่ระบุ',
          test_type: testType,
          test_name: testName,
          thai_instrument_name: thaiInstrumentName,
          lesson_name: lessonName,
          selected_answer_formatted: formatSelectedAnswer(answer.selected_answer)
        };
      });
      
      res.json(result);
    } catch (err) {
      console.error('Unexpected error in user-answers endpoint:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};