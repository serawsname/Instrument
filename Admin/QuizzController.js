const express = require('express');
const authenticateToken = require('../User/middleware/authenticateToken');

// Middleware ตรวจสอบ role admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

module.exports = (supabase) => {
  const router = express.Router();

  // GET: ดึงแบบทดสอบทั้งหมดของเครื่องดนตรี จากตารางแบบทดสอบโดยตรง
  router.get('/instruments/:instrumentId/tests', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    
    try {
      // Get lesson IDs for level tests first
      const { data: lessons } = await supabase
        .from('lesson_instrument')
        .select('lesson_id')
        .eq('thaiinstrument_id', instrumentId);
      
      const lessonIds = lessons ? lessons.map(l => l.lesson_id) : [];

      // ดึงข้อมูลจากแต่ละตารางแบบทดสอบโดยตรง
      const allTests = [];

      // 1. ดึงข้อมูล pretest
      const { data: pretests } = await supabase
        .from('pretest_instrument')
        .select('pretest_id, pretest_name, instrument_id')
        .eq('instrument_id', instrumentId);

      if (pretests) {
        pretests.forEach(test => {
          allTests.push({
            id: test.pretest_id,
            test_name: test.pretest_name,
            test_type: 'pretest',
            type: 'pretest',
            table: 'pretest_instrument',
            instrument_id: test.instrument_id
          });
        });
      }

      // 2. ดึงข้อมูล posttest
      const { data: posttests } = await supabase
        .from('posttest_instrument')
        .select('posttest_id, posttest_name, instrument_id')
        .eq('instrument_id', instrumentId);

      if (posttests) {
        posttests.forEach(test => {
          allTests.push({
            id: test.posttest_id,
            test_name: test.posttest_name,
            test_type: 'posttest',
            type: 'posttest',
            table: 'posttest_instrument',
            instrument_id: test.instrument_id
          });
        });
      }

      // 3. ดึงข้อมูล leveltestone
      const { data: levelones } = await supabase
        .from('leveltestone_instrument')
        .select('leveltestone_id, leveltestone_name, thaiinstrument_id')
        .eq('thaiinstrument_id', instrumentId);

      if (levelones) {
        levelones.forEach(test => {
          allTests.push({
            id: test.leveltestone_id,
            test_name: test.leveltestone_name,
            test_type: 'leveltestone',
            type: 'leveltestone',
            table: 'leveltestone_instrument',
            instrument_id: test.thaiinstrument_id
          });
        });
      }

      // 4. ดึงข้อมูล leveltesttwo (ผ่าน lesson)
      if (lessonIds.length > 0) {
        const { data: leveltwos } = await supabase
          .from('leveltesttwo_instrument')
          .select('leveltesttwo_id, leveltwo_name, lesson_id')
          .in('lesson_id', lessonIds);

        if (leveltwos) {
          leveltwos.forEach(test => {
            allTests.push({
              id: test.leveltesttwo_id,
              test_name: test.leveltwo_name,
              test_type: 'leveltesttwo',
              type: 'leveltesttwo',
              table: 'leveltesttwo_instrument',
              lesson_id: test.lesson_id
            });
          });
        }
      }

      // 5. ดึงข้อมูล leveltestthree (ผ่าน lesson)
      if (lessonIds.length > 0) {
        const { data: levelthrees } = await supabase
          .from('leveltestthree_instrument')
          .select('leveltestthree_id, levelthree_name, lesson_id')
          .in('lesson_id', lessonIds);

        if (levelthrees) {
          levelthrees.forEach(test => {
            allTests.push({
              id: test.leveltestthree_id,
              test_name: test.levelthree_name,
              test_type: 'leveltestthree',
              type: 'leveltestthree',
              table: 'leveltestthree_instrument',
              lesson_id: test.lesson_id
            });
          });
        }
      }

      res.json(allTests);
    } catch (error) {
      console.error('Error fetching tests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET: ดึงแบบทดสอบตามประเภท จากตาราง questiontext_instrument
  router.get('/instruments/:instrumentId/tests/:testType', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId, testType } = req.params;
    
    try {
      let query = supabase
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
          pretest_instrument!fk_questiontext_pretest(pretest_name, instrument_id),
          posttest_instrument!fk_questiontext_posttest(posttest_name, instrument_id),
          leveltestone_instrument!questiontext_instrument_leveltestone_id_fkey(leveltestone_name, thaiinstrument_id),
          leveltesttwo_instrument!fk_questiontext_leveltesttwo(leveltwo_name, lesson_id),
          leveltestthree_instrument!fk_questiontext_leveltestthree(levelthree_name, lesson_id)
        `, { count: 'exact' });

      // กรองตามประเภทแบบทดสอบและ instrument
      switch (testType) {
        case 'pretest':
          query = query
            .not('pretest_id', 'is', null)
            .eq('pretest_instrument.instrument_id', instrumentId);
          break;
        case 'posttest':
          query = query
            .not('posttest_id', 'is', null)
            .eq('posttest_instrument.instrument_id', instrumentId);
          break;
        case 'leveltestone':
          query = query
            .not('leveltestone_id', 'is', null)
            .eq('leveltestone_instrument.thaiinstrument_id', instrumentId);
          break;
        case 'leveltesttwo':
          // ต้องเชื่อมผ่าน lesson ก่อน
          const { data: lessons } = await supabase
            .from('lesson_instrument')
            .select('lesson_id')
            .eq('thaiinstrument_id', instrumentId);
          
          if (lessons && lessons.length > 0) {
            const lessonIds = lessons.map(l => l.lesson_id);
            query = query
              .not('leveltesttwo_id', 'is', null)
              .in('leveltesttwo_instrument.lesson_id', lessonIds);
          } else {
            return res.json([]);
          }
          break;
        case 'leveltestthree':
          // ต้องเชื่อมผ่าน lesson ก่อน
          const { data: lessonsThree } = await supabase
            .from('lesson_instrument')
            .select('lesson_id')
            .eq('thaiinstrument_id', instrumentId);
          
          if (lessonsThree && lessonsThree.length > 0) {
            const lessonIds = lessonsThree.map(l => l.lesson_id);
            query = query
              .not('leveltestthree_id', 'is', null)
              .in('leveltestthree_instrument.lesson_id', lessonIds);
          } else {
            return res.json([]);
          }
          break;
        default:
          return res.status(400).json({ error: 'Invalid test type' });
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${testType} tests:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      // ดึงข้อมูล test requirements สำหรับแต่ละแบบทดสอบ
      const testIds = (data || []).map(test => {
        switch (testType) {
          case 'leveltestone':
            return test.leveltestone_id;
          case 'leveltesttwo':
            return test.leveltesttwo_id;
          case 'leveltestthree':
            return test.leveltestthree_id;
          default:
            return null;
        }
      }).filter(id => id !== null);

      let testRequirements = [];
      if (testIds.length > 0) {
        // ใช้ชื่อ column ที่ถูกต้องตามประเภทแบบทดสอบ
        let columnName;
        switch (testType) {
          case 'leveltestone':
            columnName = 'leveltestone_id';
            break;
          case 'leveltesttwo':
            columnName = 'leveltesttwo_id';
            break;
          case 'leveltestthree':
            columnName = 'leveltestthree_id';
            break;
          default:
            columnName = null;
        }
        
        if (columnName) {
          const { data: requirements, error: reqError } = await supabase
            .from('testrequirement_instrument')
            .select('*')
            .in(columnName, testIds);
          
          if (reqError) {
             console.error('Error fetching test requirements:', reqError);
           }
          
          testRequirements = requirements || [];
        }
      }

      // จัดรูปแบบข้อมูลให้เป็น format เดียวกับเดิม
      const formattedTests = (data || []).map(test => {
        let testName = '';
        let testId = test.questiontext_id; // default fallback
        let actualTableId = null; // ID ของตารางที่เลือก

        switch (testType) {
          case 'pretest':
            testName = test.pretest_instrument?.pretest_name || 'ไม่มีชื่อ';
            testId = test.pretest_id; // ใช้ foreign key แทน questiontext_id
            actualTableId = test.pretest_id; // ID จากตาราง pretest_instrument
            break;
          case 'posttest':
            testName = test.posttest_instrument?.posttest_name || 'ไม่มีชื่อ';
            testId = test.posttest_id; // ใช้ foreign key แทน questiontext_id
            actualTableId = test.posttest_id; // ID จากตาราง posttest_instrument
            break;
          case 'leveltestone':
            testName = test.leveltestone_instrument?.leveltestone_name || 'ไม่มีชื่อ';
            testId = test.leveltestone_id; // ใช้ foreign key แทน questiontext_id
            actualTableId = test.leveltestone_id; // ID จากตาราง leveltestone_instrument
            break;
          case 'leveltesttwo':
            testName = test.leveltesttwo_instrument?.leveltwo_name || 'ไม่มีชื่อ';
            testId = test.leveltesttwo_id; // ใช้ foreign key แทน questiontext_id
            actualTableId = test.leveltesttwo_id; // ID จากตาราง leveltesttwo_instrument
            break;
          case 'leveltestthree':
            testName = test.leveltestthree_instrument?.levelthree_name || 'ไม่มีชื่อ';
            testId = test.leveltestthree_id; // ใช้ foreign key แทน questiontext_id
            actualTableId = test.leveltestthree_id; // ID จากตาราง leveltestthree_instrument
            break;
        }

        // หา passing_score สำหรับแบบทดสอบนี้
        let requirement = null;
        let passingScore = null;
        
        // ใช้ชื่อ column ที่ถูกต้องในการหา requirement
        switch (testType) {
          case 'leveltestone':
            requirement = testRequirements.find(req => req.leveltestone_id === actualTableId);
            break;
          case 'leveltesttwo':
            requirement = testRequirements.find(req => req.leveltesttwo_id === actualTableId);
            break;
          case 'leveltestthree':
            requirement = testRequirements.find(req => req.leveltestthree_id === actualTableId);
            break;
        }
        
        passingScore = requirement ? requirement.passing_score : null;

        return {
          id: actualTableId, // ใช้ ID ของตารางที่เลือกแทน questiontext_id
          test_name: testName,
          test_type: testType,
          type: testType,
          question_text: test.question_text,
          questiontype_id: test.questiontype_id,
          table: `${testType}_instrument`, // ระบุตารางที่ข้อมูลมาจาก
          passing_score: passingScore,
          questiontext_id: test.questiontext_id // เก็บ questiontext_id ไว้สำหรับอ้างอิง
        };
      });
      
      // กรองข้อมูลที่ไม่มีชื่อออก แต่ไม่กำจัดข้อมูลซ้ำ เพื่อให้แสดงทุก ID
      const validTests = formattedTests.filter(test => {
        // ข้ามรายการที่ไม่มีชื่อหรือชื่อเป็น "ไม่มีชื่อ" หรือไม่มี actualTableId
        return test.test_name && 
               test.test_name !== 'ไม่มีชื่อ' && 
               test.test_name.trim() !== '' &&
               test.id !== null;
      });
      
      res.json(validTests);
    } catch (error) {
      console.error(`Error fetching ${testType} tests:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST: เพิ่มแบบทดสอบใหม่
  router.post('/tests', authenticateToken, requireAdmin, async (req, res) => {
    const { test_name, test_type, instrument_id, lesson_id } = req.body;

    if (!test_name || !test_type || !instrument_id) {
      return res.status(400).json({ error: 'Missing required fields: test_name, test_type, instrument_id' });
    }

    let tableName, insertData;
    switch (test_type) {
      case 'leveltestone':
        tableName = 'leveltestone_instrument';
        insertData = { 
          leveltestone_name: test_name, 
          thaiinstrument_id: parseInt(instrument_id)
        };
        break;
      case 'leveltesttwo':
        if (!lesson_id) {
          return res.status(400).json({ error: 'lesson_id is required for leveltesttwo' });
        }
        tableName = 'leveltesttwo_instrument';
        insertData = { 
          leveltwo_name: test_name, 
          lesson_id: parseInt(lesson_id)
        };
        break;
      case 'leveltestthree':
        if (!lesson_id) {
          return res.status(400).json({ error: 'lesson_id is required for leveltestthree' });
        }
        tableName = 'leveltestthree_instrument';
        insertData = { 
          levelthree_name: test_name, 
          lesson_id: parseInt(lesson_id)
        };
        break;
      case 'pretest':
        tableName = 'pretest_instrument';
        insertData = { 
          pretest_name: test_name, 
          instrument_id: parseInt(instrument_id)
        };
        break;
      case 'posttest':
        tableName = 'posttest_instrument';
        insertData = { 
          posttest_name: test_name, 
          instrument_id: parseInt(instrument_id)
        };
        break;
      case 'lesson':
        tableName = 'lesson_instrument';
        insertData = { 
          lesson_name: test_name, 
          thaiinstrument_id: parseInt(instrument_id)
        };
        break;
      default:
        return res.status(400).json({ error: 'Invalid test type' });
    }

    try {
      // สำหรับ leveltestone และ leveltestthree ให้ตรวจสอบข้อมูลที่มีอยู่แล้วก่อน
      if (test_type === 'leveltestone') {
        const { data: existingData } = await supabase
          .from(tableName)
          .select('*')
          .eq('leveltestone_name', test_name)
          .eq('thaiinstrument_id', parseInt(instrument_id))
          .single();
          
        if (existingData) {
          return res.status(200).json({ ...existingData, type: test_type, table: tableName, message: 'Test already exists' });
        }
        
        // หา leveltestone_id ที่ใหญ่ที่สุดและเพิ่ม 1
        const { data: maxData } = await supabase
          .from(tableName)
          .select('leveltestone_id')
          .order('leveltestone_id', { ascending: false })
          .limit(1)
          .single();
          
        const nextId = maxData ? maxData.leveltestone_id + 1 : 1;
        insertData.leveltestone_id = nextId;
        
      } else if (test_type === 'leveltestthree') {
        const { data: existingData } = await supabase
          .from(tableName)
          .select('*')
          .eq('levelthree_name', test_name)
          .eq('lesson_id', parseInt(lesson_id))
          .single();
          
        if (existingData) {
          return res.status(200).json({ ...existingData, type: test_type, table: tableName, message: 'Test already exists' });
        }
      }
      
      const { data, error } = await supabase
        .from(tableName)
        .insert([insertData])
        .select();
        
      if (error) {
        console.error(`Error inserting ${test_type}:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      res.status(201).json({ ...data[0], type: test_type, table: tableName });
    } catch (error) {
      console.error(`Error inserting ${test_type}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT: แก้ไขแบบทดสอบ ใน questiontext_instrument
  router.put('/tests/:testType/:testId', authenticateToken, requireAdmin, async (req, res) => {
    const { testType: rawTestType, testId } = req.params;
    const { test_name, question_text, lesson_id } = req.body;

    // แยก testType จาก format เช่น 'leveltesttwo_1' เป็น 'leveltesttwo'
    const testType = rawTestType.includes('_') ? rawTestType.split('_')[0] : rawTestType;
    if (!test_name && !question_text && lesson_id === undefined) {
      return res.status(400).json({ error: 'Missing test_name, question_text, or lesson_id' });
    }

    try {
      // อัปเดตข้อมูลตามประเภทของแบบทดสอบ
      let updateResult = null;
      
      if (testType === 'pretest') {
        const updateData = {};
        if (test_name) updateData.pretest_name = test_name;
        
        if (Object.keys(updateData).length > 0) {
          const { data, error } = await supabase
            .from('pretest_instrument')
            .update(updateData)
            .eq('pretest_id', testId)
            .select();
          updateResult = { data, error };
        }
      } else if (testType === 'posttest') {
        const updateData = {};
        if (test_name) updateData.posttest_name = test_name;
        
        if (Object.keys(updateData).length > 0) {
          const { data, error } = await supabase
            .from('posttest_instrument')
            .update(updateData)
            .eq('posttest_id', testId)
            .select();
          updateResult = { data, error };
        }
      } else if (testType === 'leveltestone') {
        const updateData = {};
        if (test_name) updateData.leveltestone_name = test_name;
        
        if (Object.keys(updateData).length > 0) {
          const { data, error } = await supabase
            .from('leveltestone_instrument')
            .update(updateData)
            .eq('leveltestone_id', testId)
            .select();
          updateResult = { data, error };
        }
      } else if (testType === 'leveltesttwo') {
        const updateData = {};
        if (test_name) updateData.leveltwo_name = test_name;
        if (lesson_id !== undefined) updateData.lesson_id = lesson_id;
        
        if (Object.keys(updateData).length > 0) {
          const { data, error } = await supabase
            .from('leveltesttwo_instrument')
            .update(updateData)
            .eq('leveltesttwo_id', testId)
            .select();
          updateResult = { data, error };
        }
      } else if (testType === 'leveltestthree') {
        const updateData = {};
        if (test_name) updateData.levelthree_name = test_name;
        if (lesson_id !== undefined) updateData.lesson_id = lesson_id;
        
        if (Object.keys(updateData).length > 0) {
          const { data, error } = await supabase
            .from('leveltestthree_instrument')
            .update(updateData)
            .eq('leveltestthree_id', testId)
            .select();
          updateResult = { data, error };
        }
      }

      // อัปเดต question_text ใน questiontext_instrument (ถ้ามี)
      if (question_text && updateResult && updateResult.data && updateResult.data.length > 0) {
        // หา questiontext_id ที่เกี่ยวข้องกับแบบทดสอบนี้
        let questionTextQuery = supabase.from('questiontext_instrument').select('questiontext_id');
        
        if (testType === 'pretest') {
          questionTextQuery = questionTextQuery.eq('pretest_id', testId);
        } else if (testType === 'posttest') {
          questionTextQuery = questionTextQuery.eq('posttest_id', testId);
        } else if (testType === 'leveltestone') {
          questionTextQuery = questionTextQuery.eq('leveltestone_id', testId);
        } else if (testType === 'leveltesttwo') {
          questionTextQuery = questionTextQuery.eq('leveltesttwo_id', testId);
        } else if (testType === 'leveltestthree') {
          questionTextQuery = questionTextQuery.eq('leveltestthree_id', testId);
        }

        const { data: questionTextData, error: questionTextError } = await questionTextQuery;
        
        if (!questionTextError && questionTextData && questionTextData.length > 0) {
          for (const questionText of questionTextData) {
            const { error: updateQuestionError } = await supabase
              .from('questiontext_instrument')
              .update({ question_text })
              .eq('questiontext_id', questionText.questiontext_id);
              
            if (updateQuestionError) {
              console.error(`Error updating question text:`, updateQuestionError);
            }
          }
        }
      }

      if (updateResult && updateResult.error) {
        console.error(`Error updating test:`, updateResult.error);
        return res.status(500).json({ error: updateResult.error.message });
      }

      // ตรวจสอบว่ามีการอัปเดตหรือไม่ (ถ้าไม่มีข้อมูลให้อัปเดต ให้ถือว่าสำเร็จ)
      if (!updateResult) {
        // ดึงข้อมูลปัจจุบันเพื่อส่งกลับ
        let currentDataQuery;
        if (testType === 'pretest') {
          currentDataQuery = supabase.from('pretest_instrument').select('*').eq('pretest_id', testId);
        } else if (testType === 'posttest') {
          currentDataQuery = supabase.from('posttest_instrument').select('*').eq('posttest_id', testId);
        } else if (testType === 'leveltestone') {
          currentDataQuery = supabase.from('leveltestone_instrument').select('*').eq('leveltestone_id', testId);
        } else if (testType === 'leveltesttwo') {
          currentDataQuery = supabase.from('leveltesttwo_instrument').select('*').eq('leveltesttwo_id', testId);
        } else if (testType === 'leveltestthree') {
          currentDataQuery = supabase.from('leveltestthree_instrument').select('*').eq('leveltestthree_id', testId);
        }
        
        if (currentDataQuery) {
          const { data: currentData, error: currentError } = await currentDataQuery;
          if (!currentError && currentData && currentData.length > 0) {
            updateResult = { data: currentData, error: null };
          }
        }
      }

      if (!updateResult || !updateResult.data || updateResult.data.length === 0) {
        return res.status(404).json({ error: 'Test not found' });
      }
      const responseData = { 
        id: testId,
        test_name: test_name || 'Updated',
        test_type: testType,
        question_text: question_text || 'Updated',
        table: 'questiontext_instrument',
        message: 'Test updated successfully'
      };
      res.json(responseData);
    } catch (error) {
      console.error(`Error updating ${testType}:`, error);
      console.error('Full error stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE: ลบแบบทดสอบ จาก questiontext_instrument
  router.delete('/tests/:testType/:testId', authenticateToken, requireAdmin, async (req, res) => {
    const { testType, testId } = req.params;
    
    try {
      // ดึงข้อมูลก่อนลบเพื่อหา foreign key ที่เกี่ยวข้อง
      const { data: questionData, error: fetchError } = await supabase
        .from('questiontext_instrument')
        .select('*')
        .eq('questiontext_id', testId)
        .single();

      if (fetchError) {
        console.error(`Error fetching question data:`, fetchError);
        return res.status(500).json({ error: fetchError.message });
      }

      if (!questionData) {
        return res.status(404).json({ error: 'Test not found' });
      }

      // ลบข้อมูลจากตารางที่เกี่ยวข้องก่อน (ถ้าจำเป็น)
      // ในกรณีนี้ foreign key constraints จะจัดการให้

      // ลบจาก questiontext_instrument
      const { error: deleteError } = await supabase
        .from('questiontext_instrument')
        .delete()
        .eq('questiontext_id', testId);
        
      if (deleteError) {
        console.error(`Error deleting ${testType}:`, deleteError);
        return res.status(500).json({ error: deleteError.message });
      }
      
      res.json({ message: `${testType} deleted successfully` });
    } catch (error) {
      console.error(`Error deleting ${testType}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET: ดึงรายการประเภทแบบทดสอบพร้อมชื่อจริงจากฐานข้อมูล
  router.get('/instruments/:instrumentId/test-types', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    
    try {
      const testTypes = [];

      // ดึง pretest
      const { data: pretests } = await supabase
        .from('pretest_instrument')
        .select('pretest_id, pretest_name')
        .eq('instrument_id', instrumentId);

      if (pretests && pretests.length > 0) {
        pretests.forEach(pretest => {
          testTypes.push({
            value: `pretest_${pretest.pretest_id}`,
            label: pretest.pretest_name,
            type: 'pretest',
            id: pretest.pretest_id
          });
        });
      }

      // ดึง posttest
      const { data: posttests } = await supabase
        .from('posttest_instrument')
        .select('posttest_id, posttest_name')
        .eq('instrument_id', instrumentId);

      if (posttests && posttests.length > 0) {
        posttests.forEach(posttest => {
          testTypes.push({
            value: `posttest_${posttest.posttest_id}`,
            label: posttest.posttest_name,
            type: 'posttest',
            id: posttest.posttest_id
          });
        });
      }

      // ดึง leveltestone
      const { data: levelones } = await supabase
        .from('leveltestone_instrument')
        .select('leveltestone_id, leveltestone_name')
        .eq('thaiinstrument_id', instrumentId);

      if (levelones && levelones.length > 0) {
        levelones.forEach(levelone => {
          testTypes.push({
            value: `leveltestone_${levelone.leveltestone_id}`,
            label: levelone.leveltestone_name,
            type: 'leveltestone',
            id: levelone.leveltestone_id
          });
        });
      }

      // ดึง leveltesttwo (ผ่าน lesson)
      const { data: lessons } = await supabase
        .from('lesson_instrument')
        .select('lesson_id')
        .eq('thaiinstrument_id', instrumentId);

      if (lessons && lessons.length > 0) {
        const lessonIds = lessons.map(l => l.lesson_id);

        const { data: leveltwos } = await supabase
          .from('leveltesttwo_instrument')
          .select('leveltesttwo_id, leveltwo_name')
          .in('lesson_id', lessonIds);

        if (leveltwos && leveltwos.length > 0) {
           leveltwos.forEach(leveltwo => {
             testTypes.push({
               value: `leveltesttwo_${leveltwo.leveltesttwo_id}`,
               label: leveltwo.leveltwo_name,
               type: 'leveltesttwo',
               id: leveltwo.leveltesttwo_id
             });
           });
         }

         // ดึง leveltestthree (ผ่าน lesson)
         const { data: levelthrees } = await supabase
           .from('leveltestthree_instrument')
           .select('leveltestthree_id, levelthree_name')
           .in('lesson_id', lessonIds);

         if (levelthrees && levelthrees.length > 0) {
           levelthrees.forEach(levelthree => {
             testTypes.push({
               value: `leveltestthree_${levelthree.leveltestthree_id}`,
               label: levelthree.levelthree_name,
               type: 'leveltestthree',
               id: levelthree.leveltestthree_id
             });
           });
         }
      }

      res.json(testTypes);
    } catch (error) {
      console.error('Error fetching test types:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET: ดึงข้อมูล lessons ตาม instrument
  router.get('/instruments/:instrumentId/lessons', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    
    try {
      const { data: lessons, error } = await supabase
        .from('lesson_instrument')
        .select('lesson_id, lesson_name')
        .eq('thaiinstrument_id', instrumentId)
        .order('lesson_name');

      if (error) {
        console.error('Error fetching lessons:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(lessons || []);
    } catch (error) {
      console.error('Error in lessons endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET: ดึงข้อมูล test requirements
  router.get('/test-requirements/:testType/:testId', authenticateToken, requireAdmin, async (req, res) => {
    const { testType, testId } = req.params;
    
    try {
      let whereClause = {};
      
      switch (testType) {
        case 'leveltestone':
          whereClause.leveltestone_id = testId;
          break;
        case 'leveltesttwo':
          whereClause.leveltesttwo_id = testId;
          break;
        case 'leveltestthree':
          whereClause.leveltestthree_id = testId;
          break;
        default:
          return res.status(400).json({ error: 'Invalid test type' });
      }

      const { data: requirement, error } = await supabase
        .from('testrequirement_instrument')
        .select('*')
        .match(whereClause)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching test requirement:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(requirement || null);
    } catch (error) {
      console.error('Error in test requirements endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST: สร้าง test requirement ใหม่
  router.post('/test-requirements', authenticateToken, requireAdmin, async (req, res) => {
    const { testType, testId, passingScore } = req.body;
    
    try {
      if (!testType || !testId || !passingScore) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let insertData = { passing_score: passingScore };
      
      switch (testType) {
        case 'leveltestone':
          insertData.leveltestone_id = testId;
          break;
        case 'leveltesttwo':
          insertData.leveltesttwo_id = testId;
          break;
        case 'leveltestthree':
          insertData.leveltestthree_id = testId;
          break;
        default:
          return res.status(400).json({ error: 'Invalid test type' });
      }

      const { data: requirement, error } = await supabase
        .from('testrequirement_instrument')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating test requirement:', error);
        return res.status(500).json({ error: error.message });
      }

      res.status(201).json(requirement);
    } catch (error) {
      console.error('Error in create test requirement endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT: อัปเดต test requirement
  router.put('/test-requirements/:requirementId', authenticateToken, requireAdmin, async (req, res) => {
    const { requirementId } = req.params;
    const { passingScore } = req.body;
    
    try {
      if (!passingScore) {
        return res.status(400).json({ error: 'Missing passing score' });
      }

      const { data: requirement, error } = await supabase
        .from('testrequirement_instrument')
        .update({ passing_score: passingScore })
        .eq('requirement_id', requirementId)
        .select()
        .single();

      if (error) {
        console.error('Error updating test requirement:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(requirement);
    } catch (error) {
      console.error('Error in update test requirement endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE: ลบ test requirement
  router.delete('/test-requirements/:requirementId', authenticateToken, requireAdmin, async (req, res) => {
    const { requirementId } = req.params;
    
    try {
      const { error } = await supabase
        .from('testrequirement_instrument')
        .delete()
        .eq('requirement_id', requirementId);

      if (error) {
        console.error('Error deleting test requirement:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ message: 'Test requirement deleted successfully' });
    } catch (error) {
      console.error('Error in delete test requirement endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};