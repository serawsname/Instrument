// File: TestHistory/UserHistory.js
const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // API endpoint เดิมสำหรับดึงประวัติการปลดล็อก
  router.get('/user-history/username/:username', async (req, res) => {
    const { username } = req.params;
    try {
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('user_id')
        .eq('username', username)
        .maybeSingle(); // ใช้ maybeSingle() แทน single() เพื่อให้ return null เมื่อไม่พบข้อมูล

      if (userError) {
        console.error('User history user error:', userError);
        throw new Error(userError.message);
      }
      if (!userData) {
        return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้ที่ระบุ' });
      }
      const userId = userData.user_id;

      // ดึงข้อมูลจาก user_unlock table
      const { data: unlockData, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (unlockError) {
        console.error('Query error on user_unlock:', unlockError.message);
        throw new Error(unlockError.message);
      }

      if (!unlockData || unlockData.length === 0) {
        return res.json({ success: true, data: [] });
      }
      // แยกข้อมูลตามประเภท
      const levelTestOneIds = unlockData
        .filter(item => item.test_type === 'leveltestone')
        .map(item => item.test_id);
      
      const levelTestTwoIds = unlockData
        .filter(item => item.test_type === 'leveltesttwo')
        .map(item => item.test_id);
      
      const levelTestThreeIds = unlockData
        .filter(item => item.test_type === 'leveltestthree')
        .map(item => item.test_id);
      
      const posttestIds = unlockData
        .filter(item => item.test_type === 'posttest')
        .map(item => item.test_id);
      // ดึงข้อมูลแบบทดสอบแต่ละประเภท
      let levelTestOneData = [];
      let levelTestTwoData = [];
      let levelTestThreeData = [];
      let posttestData = [];

      if (levelTestOneIds.length > 0) {
        const { data: l1Data, error: l1Error } = await supabase
          .from('leveltestone_instrument')
          .select('leveltestone_id, leveltestone_name, thaiinstrument_id')
          .in('leveltestone_id', levelTestOneIds);
        
        if (l1Error) {
          console.error('❌ Error fetching leveltestone:', l1Error);
          throw l1Error;
        }
        levelTestOneData = l1Data;
      }

      if (levelTestTwoIds.length > 0) {
        const { data: l2Data, error: l2Error } = await supabase
          .from('leveltesttwo_instrument')
          .select('leveltesttwo_id, leveltwo_name, lesson_id')
          .in('leveltesttwo_id', levelTestTwoIds);
        
        if (l2Error) throw l2Error;
        levelTestTwoData = l2Data;
      }

      if (levelTestThreeIds.length > 0) {
        const { data: l3Data, error: l3Error } = await supabase
          .from('leveltestthree_instrument')
          .select('leveltestthree_id, levelthree_name, lesson_id')
          .in('leveltestthree_id', levelTestThreeIds);
        
        if (l3Error) throw l3Error;
        levelTestThreeData = l3Data;
      }

      if (posttestIds.length > 0) {
        const { data: pData, error: pError } = await supabase
          .from('posttest_instrument')
          .select('posttest_id, posttest_name, instrument_id')
          .in('posttest_id', posttestIds);
        
        if (pError) throw pError;
        posttestData = pData;
      }

      // ดึงข้อมูล lesson และ instrument สำหรับ leveltest
      let lessonData = [];
      if (levelTestTwoData.length > 0 || levelTestThreeData.length > 0) {
        const lessonIds = [
          ...levelTestTwoData.map(item => item.lesson_id),
          ...levelTestThreeData.map(item => item.lesson_id)
        ].filter(id => id != null);

        if (lessonIds.length > 0) {
          const { data: lData, error: lError } = await supabase
            .from('lesson_instrument')
            .select('lesson_id, thaiinstrument_id')
            .in('lesson_id', lessonIds);
          
          if (lError) throw lError;
          lessonData = lData;
        }
      }

      // ดึงข้อมูลเครื่องดนตรีทั้งหมด
      const { data: instruments, error: instError } = await supabase
        .from('thai_instrument')
        .select('thaiinstrument_id, thaiinstrument_name');

      if (instError) throw instError;
      const instrumentMap = new Map(instruments.map(inst => [inst.thaiinstrument_id, inst.thaiinstrument_name]));

      // สร้าง Map สำหรับ lesson_id -> instrument_id
      const lessonInstrumentMap = new Map(lessonData.map(lesson => [lesson.lesson_id, lesson.thaiinstrument_id]));

      // แปลงข้อมูลให้เป็นรูปแบบที่ต้องการ
      const enrichedData = [];

      // ประมวลผล leveltestone
      for (const unlockItem of unlockData.filter(item => item.test_type === 'leveltestone')) {
        const testData = levelTestOneData.find(test => test.leveltestone_id === unlockItem.test_id);
        if (testData) {
          const instrumentName = instrumentMap.get(testData.thaiinstrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี';
          
          enrichedData.push({
            user_id: unlockItem.user_id,
            test_type: 'leveltestone',
            test_name: testData.leveltestone_name,
            instrument_id: testData.thaiinstrument_id,
            instrument_name: instrumentName,
            unlocked_at: unlockItem.unlocked_at,
            display_text: 'ผ่านแบบทดสอบระดับต้น',
            status: 'สำเร็จ'
          });
        } else {
        }
      }

      // ประมวลผล leveltesttwo
      for (const unlockItem of unlockData.filter(item => item.test_type === 'leveltesttwo')) {
        const testData = levelTestTwoData.find(test => test.leveltesttwo_id === unlockItem.test_id);
        if (testData) {
          const instrumentId = lessonInstrumentMap.get(testData.lesson_id);
          const instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
          
          enrichedData.push({
            user_id: unlockItem.user_id,
            test_type: 'leveltesttwo',
            test_name: testData.leveltwo_name,
            instrument_id: instrumentId,
            instrument_name: instrumentName,
            unlocked_at: unlockItem.unlocked_at,
            display_text: 'ผ่านแบบทดสอบระดับปานกลาง',
            status: 'สำเร็จ'
          });
        }
      }

      // ประมวลผล leveltestthree
      for (const unlockItem of unlockData.filter(item => item.test_type === 'leveltestthree')) {
        const testData = levelTestThreeData.find(test => test.leveltestthree_id === unlockItem.test_id);
        if (testData) {
          const instrumentId = lessonInstrumentMap.get(testData.lesson_id);
          const instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
          
          enrichedData.push({
            user_id: unlockItem.user_id,
            test_type: 'leveltestthree',
            test_name: testData.levelthree_name,
            instrument_id: instrumentId,
            instrument_name: instrumentName,
            unlocked_at: unlockItem.unlocked_at,
            display_text: 'ผ่านแบบทดสอบระดับสูง',
            status: 'สำเร็จ'
          });
        }
      }

      // ประมวลผล posttest
      for (const unlockItem of unlockData.filter(item => item.test_type === 'posttest')) {
        const testData = posttestData.find(test => test.posttest_id === unlockItem.test_id);
        if (testData) {
          const instrumentName = instrumentMap.get(testData.instrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี';
          
          enrichedData.push({
            user_id: unlockItem.user_id,
            test_type: 'posttest',
            test_name: testData.posttest_name,
            instrument_id: testData.instrument_id,
            instrument_name: instrumentName,
            unlocked_at: unlockItem.unlocked_at,
            display_text: 'ผ่านแบบทดสอบหลังเรียน',
            status: 'สำเร็จ'
          });
        }
      }
      res.json({ success: true, data: enrichedData });
    } catch (err) {
      console.error('❌ Error in /user-history:', err.message);
      console.error('❌ Error stack:', err.stack);
      res.status(500).json({ 
        success: false, 
        message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  // API endpoint ใหม่สำหรับดึงประวัติคำตอบจริงๆ
  router.get('/user-answer-history/username/:username', async (req, res) => {
    const { username } = req.params;
    try {
      // ดึง user_id จาก username
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('user_id')
        .eq('username', username)
        .maybeSingle();

      if (userError) {
        console.error('User answer history user error:', userError);
        throw new Error(userError.message);
      }
      if (!userData) {
        return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้ที่ระบุ' });
      }
      const userId = userData.user_id;

      // ดึงข้อมูล user_answer ทั้งหมดของผู้ใช้
      const { data: userAnswers, error: answerError } = await supabase
        .from('user_answer')
        .select('*')
        .eq('user_id', userId)
        .order('answered_at', { ascending: false });

      if (answerError) {
        console.error('Query error on user_answer:', answerError.message);
        throw answerError;
      }

      // ดึงข้อมูล user_unlock ทั้งหมดของผู้ใช้
      const { data: userUnlocks, error: unlockError } = await supabase
        .from('user_unlock')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (unlockError) {
        console.error('Query error on user_unlock:', unlockError.message);
        throw unlockError;
      }
      // สร้างข้อมูลประวัติจาก user_answer
      const answerHistory = [];
      if (userAnswers && userAnswers.length > 0) {
        // ดึง question IDs ทั้งหมด
        const questionIds = userAnswers.map(answer => answer.question_id);

        // ดึงข้อมูลคำถามและข้อมูลที่เกี่ยวข้อง
        const { data: questions, error: questionError } = await supabase
          .from('questiontext_instrument')
          .select(`
            questiontext_id,
            question_text,
            pretest_id,
            posttest_id,
            leveltestone_id,
            leveltesttwo_id,
            leveltestthree_id,
            questiontype_instrument (
              questiontype_id,
              questiontype_name
            )
          `)
          .in('questiontext_id', questionIds);

        if (questionError) {
          console.error('Query error on questiontext_instrument:', questionError.message);
          throw questionError;
        }

        // สร้าง Map สำหรับ question_id -> question data
        const questionMap = new Map(questions.map(q => [q.questiontext_id, q]));

        // ดึงข้อมูลแบบทดสอบแต่ละประเภท
        const pretestIds = [...new Set(questions.map(q => q.pretest_id).filter(id => id != null))];
        const posttestIds = [...new Set(questions.map(q => q.posttest_id).filter(id => id != null))];
        const leveltestoneIds = [...new Set(questions.map(q => q.leveltestone_id).filter(id => id != null))];
        const leveltesttwoIds = [...new Set(questions.map(q => q.leveltesttwo_id).filter(id => id != null))];
        const leveltestthreeIds = [...new Set(questions.map(q => q.leveltestthree_id).filter(id => id != null))];

        // ดึงข้อมูลแบบทดสอบ
        let pretestData = [];
        let posttestData = [];
        let leveltestoneData = [];
        let leveltesttwoData = [];
        let leveltestthreeData = [];

        if (pretestIds.length > 0) {
          const { data: pData, error: pError } = await supabase
            .from('pretest_instrument')
            .select('pretest_id, pretest_name, instrument_id')
            .in('pretest_id', pretestIds);
          if (pError) throw pError;
          pretestData = pData;
        }

        if (posttestIds.length > 0) {
          const { data: pData, error: pError } = await supabase
            .from('posttest_instrument')
            .select('posttest_id, posttest_name, instrument_id')
            .in('posttest_id', posttestIds);
          if (pError) throw pError;
          posttestData = pData;
        }

        if (leveltestoneIds.length > 0) {
          const { data: l1Data, error: l1Error } = await supabase
            .from('leveltestone_instrument')
            .select('leveltestone_id, leveltestone_name, thaiinstrument_id')
            .in('leveltestone_id', leveltestoneIds);
          if (l1Error) throw l1Error;
          leveltestoneData = l1Data;
        }

        if (leveltesttwoIds.length > 0) {
          const { data: l2Data, error: l2Error } = await supabase
            .from('leveltesttwo_instrument')
            .select('leveltesttwo_id, leveltwo_name, lesson_id')
            .in('leveltesttwo_id', leveltesttwoIds);
          if (l2Error) throw l2Error;
          leveltesttwoData = l2Data;
        }

        if (leveltestthreeIds.length > 0) {
          const { data: l3Data, error: l3Error } = await supabase
            .from('leveltestthree_instrument')
            .select('leveltestthree_id, levelthree_name, lesson_id')
            .in('leveltestthree_id', leveltestthreeIds);
          if (l3Error) throw l3Error;
          leveltestthreeData = l3Data;
        }

        // ดึงข้อมูล lesson สำหรับ leveltest
        let lessonData = [];
        if (leveltesttwoIds.length > 0 || leveltestthreeIds.length > 0) {
          const lessonIds = [
            ...leveltesttwoData.map(item => item.lesson_id),
            ...leveltestthreeData.map(item => item.lesson_id)
          ].filter(id => id != null);

          if (lessonIds.length > 0) {
            const { data: lData, error: lError } = await supabase
              .from('lesson_instrument')
              .select('lesson_id, thaiinstrument_id, lesson_name')
              .in('lesson_id', lessonIds);
            if (lError) throw lError;
            lessonData = lData;
          }
        }

        // ดึงข้อมูลเครื่องดนตรี
        const { data: instruments, error: instError } = await supabase
          .from('thai_instrument')
          .select('thaiinstrument_id, thaiinstrument_name');
        if (instError) throw instError;
        const instrumentMap = new Map(instruments.map(inst => [inst.thaiinstrument_id, inst.thaiinstrument_name]));

        // สร้าง Map สำหรับ lesson_id -> lesson data
        const lessonInstrumentMap = new Map(lessonData.map(lesson => [lesson.lesson_id, lesson.thaiinstrument_id]));
        const lessonNameMap = new Map(lessonData.map(lesson => [lesson.lesson_id, lesson.lesson_name]));

        // สร้าง Map สำหรับแบบทดสอบแต่ละประเภท
        const pretestMap = new Map(pretestData.map(p => [p.pretest_id, p]));
        const posttestMap = new Map(posttestData.map(p => [p.posttest_id, p]));
        const leveltestoneMap = new Map(leveltestoneData.map(l => [l.leveltestone_id, l]));
        const leveltesttwoMap = new Map(leveltesttwoData.map(l => [l.leveltesttwo_id, l]));
        const leveltestthreeMap = new Map(leveltestthreeData.map(l => [l.leveltestthree_id, l]));

        // แปลงข้อมูลให้เป็นรูปแบบที่ต้องการ - ใช้ if แยกกันเพื่อให้คำถามหนึ่งข้อสามารถแสดงผลได้หลายประเภท
        for (const answer of userAnswers) {
          const question = questionMap.get(answer.question_id);
          if (!question) {
            continue;
          }

          // ตรวจสอบ pretest - ใช้ if แยกกันเพื่อให้คำถามหนึ่งข้อสามารถแสดงผลได้หลายประเภท
          if (question.pretest_id) {
            const pretest = pretestMap.get(question.pretest_id);
            if (pretest) {
              answerHistory.push({
                user_id: answer.user_id,
                question_id: answer.question_id,
                selected_answer: answer.selected_answer,
                is_correct: answer.is_correct,
                score: answer.score,
                answered_at: answer.answered_at,
                updated_at: answer.updated_at,
                questiontext_instrument: {
                  question_text: question.question_text,
                  questiontype_instrument: question.questiontype_instrument,
                  test_type: 'pretest',
                  test_name: pretest.pretest_name,
                  instrument_id: pretest.instrument_id,
                  instrument_name: instrumentMap.get(pretest.instrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                }
              });
            }
          }

          // ตรวจสอบ posttest
          if (question.posttest_id) {
            const posttest = posttestMap.get(question.posttest_id);
            if (posttest) {
              answerHistory.push({
                user_id: answer.user_id,
                question_id: answer.question_id,
                selected_answer: answer.selected_answer,
                is_correct: answer.is_correct,
                score: answer.score,
                answered_at: answer.answered_at,
                updated_at: answer.updated_at,
                questiontext_instrument: {
                  question_text: question.question_text,
                  questiontype_instrument: question.questiontype_instrument,
                  test_type: 'posttest',
                  test_name: posttest.posttest_name,
                  instrument_id: posttest.instrument_id,
                  instrument_name: instrumentMap.get(posttest.instrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                }
              });
            }
          }

          // ตรวจสอบ leveltestone
          if (question.leveltestone_id) {
            const leveltest = leveltestoneMap.get(question.leveltestone_id);
            if (leveltest) {
              answerHistory.push({
                user_id: answer.user_id,
                question_id: answer.question_id,
                selected_answer: answer.selected_answer,
                is_correct: answer.is_correct,
                score: answer.score,
                answered_at: answer.answered_at,
                updated_at: answer.updated_at,
                questiontext_instrument: {
                  question_text: question.question_text,
                  questiontype_instrument: question.questiontype_instrument,
                  test_type: 'leveltestone',
                  test_name: leveltest.leveltestone_name,
                  instrument_id: leveltest.thaiinstrument_id,
                  instrument_name: instrumentMap.get(leveltest.thaiinstrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                }
              });
            }
          }

          // ตรวจสอบ leveltesttwo
          if (question.leveltesttwo_id) {
            const leveltest = leveltesttwoMap.get(question.leveltesttwo_id);
            if (leveltest) {
              const lessonInstrumentId = lessonInstrumentMap.get(leveltest.lesson_id);
              answerHistory.push({
                user_id: answer.user_id,
                question_id: answer.question_id,
                selected_answer: answer.selected_answer,
                is_correct: answer.is_correct,
                score: answer.score,
                answered_at: answer.answered_at,
                updated_at: answer.updated_at,
                questiontext_instrument: {
                  question_text: question.question_text,
                  questiontype_instrument: question.questiontype_instrument,
                  test_type: 'leveltesttwo',
                  test_name: leveltest.leveltwo_name,
                  lesson_name: lessonNameMap.get(leveltest.lesson_id) ?? 'ไม่พบชื่อบทเรียน',
                  instrument_id: lessonInstrumentId,
                  instrument_name: instrumentMap.get(lessonInstrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี'
                }
              });
            }
          }

          // ตรวจสอบ leveltestthree
          if (question.leveltestthree_id) {
            const leveltest = leveltestthreeMap.get(question.leveltestthree_id);
            if (leveltest) {
              const lessonInstrumentId = lessonInstrumentMap.get(leveltest.lesson_id);
              answerHistory.push({
                user_id: answer.user_id,
                question_id: answer.question_id,
                selected_answer: answer.selected_answer,
                is_correct: answer.is_correct,
                score: answer.score,
                answered_at: answer.answered_at,
                updated_at: answer.updated_at,
                questiontext_instrument: {
                  question_text: question.question_text,
                  questiontype_instrument: question.questiontype_instrument,
                  test_type: 'leveltestthree',
                  test_name: leveltest.levelthree_name,
                  lesson_name: lessonNameMap.get(leveltest.lesson_id) ?? 'ไม่พบชื่อบทเรียน',
                  instrument_id: lessonInstrumentId,
                  instrument_name: instrumentMap.get(lessonInstrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี'
                }
              });
            }
          }
        }
      }

      // สร้างข้อมูลประวัติจาก user_unlock (สำหรับแบบทดสอบที่ยังไม่ได้ตอบ)
      const unlockHistory = [];
      if (userUnlocks && userUnlocks.length > 0) {
        // แยกข้อมูลตามประเภท
        const levelTestOneIds = userUnlocks
          .filter(item => item.test_type === 'leveltestone')
          .map(item => item.test_id);
        
        const levelTestTwoIds = userUnlocks
          .filter(item => item.test_type === 'leveltesttwo')
          .map(item => item.test_id);
        
        const levelTestThreeIds = userUnlocks
          .filter(item => item.test_type === 'leveltestthree')
          .map(item => item.test_id);
        
        const posttestIds = userUnlocks
          .filter(item => item.test_type === 'posttest')
          .map(item => item.test_id);

        // ดึงข้อมูลแบบทดสอบแต่ละประเภท
        let levelTestOneData = [];
        let levelTestTwoData = [];
        let levelTestThreeData = [];
        let posttestData = [];

        if (levelTestOneIds.length > 0) {
          const { data: l1Data, error: l1Error } = await supabase
            .from('leveltestone_instrument')
            .select('leveltestone_id, leveltestone_name, thaiinstrument_id')
            .in('leveltestone_id', levelTestOneIds);
          if (l1Error) throw l1Error;
          levelTestOneData = l1Data;
        }

        if (levelTestTwoIds.length > 0) {
          const { data: l2Data, error: l2Error } = await supabase
            .from('leveltesttwo_instrument')
            .select('leveltesttwo_id, leveltwo_name, lesson_id')
            .in('leveltesttwo_id', levelTestTwoIds);
          if (l2Error) throw l2Error;
          levelTestTwoData = l2Data;
        }

        if (levelTestThreeIds.length > 0) {
          const { data: l3Data, error: l3Error } = await supabase
            .from('leveltestthree_instrument')
            .select('leveltestthree_id, levelthree_name, lesson_id')
            .in('leveltestthree_id', levelTestThreeIds);
          if (l3Error) throw l3Error;
          levelTestThreeData = l3Data;
        }

        if (posttestIds.length > 0) {
          const { data: pData, error: pError } = await supabase
            .from('posttest_instrument')
            .select('posttest_id, posttest_name, instrument_id')
            .in('posttest_id', posttestIds);
          if (pError) throw pError;
          posttestData = pData;
        }

        // ดึงข้อมูล lesson และ instrument สำหรับ leveltest
        let lessonData = [];
        if (levelTestTwoData.length > 0 || levelTestThreeData.length > 0) {
          const lessonIds = [
            ...levelTestTwoData.map(item => item.lesson_id),
            ...levelTestThreeData.map(item => item.lesson_id)
          ].filter(id => id != null);

          if (lessonIds.length > 0) {
            const { data: lData, error: lError } = await supabase
              .from('lesson_instrument')
              .select('lesson_id, lesson_name, thaiinstrument_id')
              .in('lesson_id', lessonIds);
            if (lError) throw lError;
            lessonData = lData;
          }
        }

        // ดึงข้อมูลเครื่องดนตรี
        const { data: instruments, error: instError } = await supabase
          .from('thai_instrument')
          .select('thaiinstrument_id, thaiinstrument_name');
        if (instError) throw instError;
        const instrumentMap = new Map(instruments.map(inst => [inst.thaiinstrument_id, inst.thaiinstrument_name]));

        // สร้าง Map สำหรับ lesson_id -> instrument_id
        const lessonInstrumentMap = new Map(lessonData.map(lesson => [lesson.lesson_id, lesson.thaiinstrument_id]));
        
        // สร้าง Map สำหรับ lesson_id -> lesson_name
        const lessonNameMap = new Map(lessonData.map(lesson => [lesson.lesson_id, lesson.lesson_name]));

        // สร้างข้อมูลสำหรับแบบทดสอบที่ปลดล็อกแล้วแต่ยังไม่ได้ตอบ
        for (const unlockItem of userUnlocks) {
          let testName = '';
          let instrumentId = null;
          let instrumentName = '';
          let lessonName = '';

          if (unlockItem.test_type === 'leveltestone') {
            const testData = levelTestOneData.find(test => test.leveltestone_id === unlockItem.test_id);
            if (testData) {
              testName = testData.leveltestone_name;
              instrumentId = testData.thaiinstrument_id;
              instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
            }
          } else if (unlockItem.test_type === 'leveltesttwo') {
            const testData = levelTestTwoData.find(test => test.leveltesttwo_id === unlockItem.test_id);
            if (testData) {
              testName = testData.leveltwo_name;
              const lessonInstrumentId = lessonInstrumentMap.get(testData.lesson_id);
              instrumentId = lessonInstrumentId;
              instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
              lessonName = lessonNameMap.get(testData.lesson_id) ?? 'ไม่พบชื่อบทเรียน';
            }
          } else if (unlockItem.test_type === 'leveltestthree') {
            const testData = levelTestThreeData.find(test => test.leveltestthree_id === unlockItem.test_id);
            if (testData) {
              testName = testData.levelthree_name;
              const lessonInstrumentId = lessonInstrumentMap.get(testData.lesson_id);
              instrumentId = lessonInstrumentId;
              instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
              lessonName = lessonNameMap.get(testData.lesson_id) ?? 'ไม่พบชื่อบทเรียน';
            }
          } else if (unlockItem.test_type === 'posttest') {
            const testData = posttestData.find(test => test.posttest_id === unlockItem.test_id);
            if (testData) {
              testName = testData.posttest_name;
              instrumentId = testData.instrument_id;
              instrumentName = instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี';
            }
          }

          // เพิ่มข้อมูลแบบทดสอบที่ปลดล็อกแล้วแต่ยังไม่ได้ตอบ
          const unlockHistoryItem = {
            user_id: unlockItem.user_id,
            question_id: null, // ไม่มีคำถามเพราะยังไม่ได้ตอบ
            selected_answer: null,
            is_correct: null,
            score: 0,
            answered_at: unlockItem.unlocked_at,
            updated_at: unlockItem.unlocked_at,
            questiontext_instrument: {
              question_text: 'แบบทดสอบที่ปลดล็อกแล้ว',
              questiontype_instrument: null,
              test_type: unlockItem.test_type,
              test_name: testName,
              instrument_id: instrumentId,
              instrument_name: instrumentName
            }
          };

          // เพิ่ม lesson_name สำหรับ leveltesttwo และ leveltestthree
          if (unlockItem.test_type === 'leveltesttwo' || unlockItem.test_type === 'leveltestthree') {
            unlockHistoryItem.questiontext_instrument.lesson_name = lessonName;
          }

          unlockHistory.push(unlockHistoryItem);
        }
      }

      // สร้างข้อมูลเพิ่มเติมสำหรับแบบทดสอบที่ผู้ใช้ปลดล็อกแล้ว
      // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับแบบทดสอบแต่ละประเภท
      const additionalHistory = [];
      if (userUnlocks && userUnlocks.length > 0) {
        // สร้าง Set ของ test_type และ test_id ที่ผู้ใช้ปลดล็อกแล้ว
        const unlockedTests = new Set();
        for (const unlock of userUnlocks) {
          unlockedTests.add(`${unlock.test_type}_${unlock.test_id}`);
        }

        // ดึงคำถามทั้งหมดที่เกี่ยวข้องกับแบบทดสอบที่ผู้ใช้ปลดล็อกแล้ว
        const { data: allQuestions, error: questionError } = await supabase
          .from('questiontext_instrument')
          .select(`
            questiontext_id,
            question_text,
            pretest_id,
            posttest_id,
            leveltestone_id,
            leveltesttwo_id,
            leveltestthree_id,
            questiontype_instrument (
              questiontype_id,
              questiontype_name
            )
          `)
          .or(`pretest_id.not.is.null,posttest_id.not.is.null,leveltestone_id.not.is.null,leveltesttwo_id.not.is.null,leveltestthree_id.not.is.null`);

        if (questionError) {
          console.error('Query error on all questions:', questionError.message);
          throw questionError;
        }

        // ดึงข้อมูลแบบทดสอบทั้งหมด
        const { data: allPretests, error: pretestError } = await supabase
          .from('pretest_instrument')
          .select('pretest_id, pretest_name, instrument_id');
        if (pretestError) throw pretestError;

        const { data: allPosttests, error: posttestError } = await supabase
          .from('posttest_instrument')
          .select('posttest_id, posttest_name, instrument_id');
        if (posttestError) throw posttestError;

        const { data: allLeveltestones, error: leveltestoneError } = await supabase
          .from('leveltestone_instrument')
          .select('leveltestone_id, leveltestone_name, thaiinstrument_id');
        if (leveltestoneError) throw leveltestoneError;

        const { data: allLeveltesttwos, error: leveltesttwoError } = await supabase
          .from('leveltesttwo_instrument')
          .select('leveltesttwo_id, leveltwo_name, lesson_id');
        if (leveltesttwoError) throw leveltesttwoError;

        const { data: allLeveltestthrees, error: leveltestthreeError } = await supabase
          .from('leveltestthree_instrument')
          .select('leveltestthree_id, levelthree_name, lesson_id');
        if (leveltestthreeError) throw leveltestthreeError;

        // ดึงข้อมูล lesson และ instrument
        const { data: allLessons, error: lessonError } = await supabase
          .from('lesson_instrument')
          .select('lesson_id, lesson_name, thaiinstrument_id');
        if (lessonError) throw lessonError;

        const { data: allInstruments, error: instrumentError } = await supabase
          .from('thai_instrument')
          .select('thaiinstrument_id, thaiinstrument_name');
        if (instrumentError) throw instrumentError;

        // สร้าง Map สำหรับข้อมูลทั้งหมด
        const pretestMap = new Map(allPretests.map(p => [p.pretest_id, p]));
        const posttestMap = new Map(allPosttests.map(p => [p.posttest_id, p]));
        const leveltestoneMap = new Map(allLeveltestones.map(l => [l.leveltestone_id, l]));
        const leveltesttwoMap = new Map(allLeveltesttwos.map(l => [l.leveltesttwo_id, l]));
        const leveltestthreeMap = new Map(allLeveltestthrees.map(l => [l.leveltestthree_id, l]));
        const lessonMap = new Map(allLessons.map(l => [l.lesson_id, l]));
        const lessonNameMap = new Map(allLessons.map(l => [l.lesson_id, l.lesson_name]));
        const instrumentMap = new Map(allInstruments.map(i => [i.thaiinstrument_id, i]));

        // Debug: ตรวจสอบข้อมูล lesson
        console.log('🔍 Debug allLessons:', allLessons);
        console.log('🔍 Debug lessonNameMap:', Array.from(lessonNameMap.entries()));

        // สร้างข้อมูลสำหรับคำถามแต่ละข้อ
        for (const question of allQuestions) {
          // ตรวจสอบว่าเป็นแบบทดสอบประเภทใด - ใช้ if แยกกันเพื่อให้คำถามหนึ่งข้อสามารถแสดงผลได้หลายประเภท
          
          // ตรวจสอบ pretest
          if (question.pretest_id) {
            const pretest = pretestMap.get(question.pretest_id);
            if (pretest) {
              const isUnlocked = unlockedTests.has(`pretest_${question.pretest_id}`);
              if (isUnlocked) {
                const existingAnswer = userAnswers?.find(answer => answer.question_id == question.questiontext_id);
                if (!existingAnswer) {
                  additionalHistory.push({
                    user_id: userId,
                    question_id: question.questiontext_id,
                    selected_answer: null,
                    is_correct: null,
                    score: 0,
                    answered_at: null,
                    updated_at: null,
                    questiontext_instrument: {
                      question_text: question.question_text,
                      questiontype_instrument: question.questiontype_instrument,
                      test_type: 'pretest',
                      test_name: pretest.pretest_name,
                      instrument_id: pretest.instrument_id,
                      instrument_name: instrumentMap.get(pretest.instrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                    }
                  });
                }
              }
            }
          }
          
          // ตรวจสอบ posttest
          if (question.posttest_id) {
            const posttest = posttestMap.get(question.posttest_id);
            if (posttest) {
              const isUnlocked = unlockedTests.has(`posttest_${question.posttest_id}`);
              if (isUnlocked) {
                const existingAnswer = userAnswers?.find(answer => answer.question_id == question.questiontext_id);
                if (!existingAnswer) {
                  additionalHistory.push({
                    user_id: userId,
                    question_id: question.questiontext_id,
                    selected_answer: null,
                    is_correct: null,
                    score: 0,
                    answered_at: null,
                    updated_at: null,
                    questiontext_instrument: {
                      question_text: question.question_text,
                      questiontype_instrument: question.questiontype_instrument,
                      test_type: 'posttest',
                      test_name: posttest.posttest_name,
                      instrument_id: posttest.instrument_id,
                      instrument_name: instrumentMap.get(posttest.instrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                    }
                  });
                }
              }
            }
          }
          
          // ตรวจสอบ leveltestone
          if (question.leveltestone_id) {
            const leveltest = leveltestoneMap.get(question.leveltestone_id);
            if (leveltest) {
              const isUnlocked = unlockedTests.has(`leveltestone_${question.leveltestone_id}`);
              if (isUnlocked) {
                const existingAnswer = userAnswers?.find(answer => answer.question_id == question.questiontext_id);
                if (!existingAnswer) {
                  additionalHistory.push({
                    user_id: userId,
                    question_id: question.questiontext_id,
                    selected_answer: null,
                    is_correct: null,
                    score: 0,
                    answered_at: null,
                    updated_at: null,
                    questiontext_instrument: {
                      question_text: question.question_text,
                      questiontype_instrument: question.questiontype_instrument,
                      test_type: 'leveltestone',
                      test_name: leveltest.leveltestone_name,
                      instrument_id: leveltest.thaiinstrument_id,
                      instrument_name: instrumentMap.get(leveltest.thaiinstrument_id) ?? 'ไม่พบชื่อเครื่องดนตรี'
                    }
                  });
                }
              }
            }
          }
          
          // ตรวจสอบ leveltesttwo
          if (question.leveltesttwo_id) {
            const leveltest = leveltesttwoMap.get(question.leveltesttwo_id);
            if (leveltest) {
              const isUnlocked = unlockedTests.has(`leveltesttwo_${question.leveltesttwo_id}`);
              if (isUnlocked) {
                const existingAnswer = userAnswers?.find(answer => answer.question_id == question.questiontext_id);
                if (!existingAnswer) {
                  const lesson = lessonMap.get(leveltest.lesson_id);
                  const instrumentId = lesson?.thaiinstrument_id;
                  const lessonName = lessonNameMap.get(leveltest.lesson_id) ?? 'ไม่พบชื่อบทเรียน';
                  
                  // Debug: ตรวจสอบข้อมูล lesson_id และ lessonName
                  console.log('🔍 Debug leveltesttwo - lesson_id:', leveltest.lesson_id, 'lessonName:', lessonName);
                  
                  additionalHistory.push({
                    user_id: userId,
                    question_id: question.questiontext_id,
                    selected_answer: null,
                    is_correct: null,
                    score: 0,
                    answered_at: null,
                    updated_at: null,
                    questiontext_instrument: {
                      question_text: question.question_text,
                      questiontype_instrument: question.questiontype_instrument,
                      test_type: 'leveltesttwo',
                      test_name: leveltest.leveltwo_name,
                      instrument_id: instrumentId,
                      instrument_name: instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี',
                      lesson_name: lessonName
                    }
                  });
                }
              }
            }
          }
          
          // ตรวจสอบ leveltestthree
          if (question.leveltestthree_id) {
            const leveltest = leveltestthreeMap.get(question.leveltestthree_id);
            if (leveltest) {
              const isUnlocked = unlockedTests.has(`leveltestthree_${question.leveltestthree_id}`);
              if (isUnlocked) {
                const existingAnswer = userAnswers?.find(answer => answer.question_id == question.questiontext_id);
                if (!existingAnswer) {
                  const lesson = lessonMap.get(leveltest.lesson_id);
                  const instrumentId = lesson?.thaiinstrument_id;
                  const lessonName = lessonNameMap.get(leveltest.lesson_id) ?? 'ไม่พบชื่อบทเรียน';
                  additionalHistory.push({
                    user_id: userId,
                    question_id: question.questiontext_id,
                    selected_answer: null,
                    is_correct: null,
                    score: 0,
                    answered_at: null,
                    updated_at: null,
                    questiontext_instrument: {
                      question_text: question.question_text,
                      questiontype_instrument: question.questiontype_instrument,
                      test_type: 'leveltestthree',
                      test_name: leveltest.levelthree_name,
                      instrument_id: instrumentId,
                      instrument_name: instrumentMap.get(instrumentId) ?? 'ไม่พบชื่อเครื่องดนตรี',
                      lesson_name: lessonName
                    }
                  });
                }
              }
            }
          }
        }
      }

      // รวมข้อมูลจากทั้งสามแหล่ง
      const allHistory = [...answerHistory, ...unlockHistory, ...additionalHistory];
      res.json({ success: true, data: allHistory });
    } catch (err) {
      console.error('❌ Error in /user-answer-history:', err.message);
      console.error('❌ Error stack:', err.stack);
      res.status(500).json({ 
        success: false, 
        message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  return router;
};