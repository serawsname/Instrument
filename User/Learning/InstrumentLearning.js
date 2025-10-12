const express = require('express');
const router = express.Router();

module.exports = function(supabase) {
  // GET: ตรวจสอบว่ามีเนื้อหาการเรียนรู้สำหรับเครื่องดนตรีนี้หรือไม่
  router.get('/check-learning/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('lesson_instrument')
        .select(`
          lesson_id,
          learning_instrument (
            learning_id
          )
        `)
        .eq('thaiinstrument_id', id);

      if (error) {
        throw error;
      }

      // ตรวจสอบว่ามี lesson และ learning content หรือไม่
      const hasLearningContent = data && data.length > 0 && 
        data.some(lesson => lesson.learning_instrument && lesson.learning_instrument.length > 0);
      
      res.status(200).json({ 
        hasLearningContent: hasLearningContent,
        lessonCount: data ? data.length : 0
      });
    } catch (err) {
      console.error('Error checking instrument learning content:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/learning/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('thai_instrument')
        .select(`
          thaiinstrument_name,
          lesson_instrument (
            lesson_name,
            learning_instrument (
              learning_name,
              learning_text,
              learningmedia_instrument (
                learningmedia_image,
                learningmedia_audio
              )
            )
          )
        `)
        .eq('thaiinstrument_id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Instrument not found' });
        }
        throw error;
      }

      // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการ
      const learningTopics = [];
      if (data.lesson_instrument) {
        for (const lesson of data.lesson_instrument) {
          if (lesson.learning_instrument) {
            for (const learning of lesson.learning_instrument) {
              learningTopics.push({
                learning_name: learning.learning_name,
                learning_text: learning.learning_text,
                media: learning.learningmedia_instrument || [],
              });
            }
          }
        }
      }

      const responseData = {
        name: data.thaiinstrument_name,
        learning_topics: learningTopics,
      };

      res.status(200).json(responseData);
    } catch (err) {
      console.error('Error fetching instrument learning details:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึงรายการบทเรียน (lessons) สำหรับเครื่องดนตรีนี้
  router.get('/lessons/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid Instrument ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('thai_instrument')
        .select(`
          thaiinstrument_name,
          lesson_instrument (
            lesson_id,
            lesson_name
          )
        `)
        .eq('thaiinstrument_id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Instrument not found' });
        }
        throw error;
      }

      const responseData = {
        instrument_name: data.thaiinstrument_name,
        lessons: data.lesson_instrument || [],
      };

      res.status(200).json(responseData);
    } catch (err) {
      console.error('Error fetching instrument lessons:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึงเนื้อหาการเรียนรู้ (learning content) สำหรับบทเรียนนี้
  router.get('/lesson-content/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('lesson_instrument')
        .select(`
          lesson_name,
          learning_instrument (
            learning_id,
            learning_name,
            learning_text,
            learningmedia_instrument (
              learningmedia_image,
              learningmedia_audio
            )
          )
        `)
        .eq('lesson_id', lessonId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Lesson not found' });
        }
        throw error;
      }

      const responseData = {
        lesson_name: data.lesson_name,
        learning_topics: data.learning_instrument || [],
      };

      res.status(200).json(responseData);
    } catch (err) {
      console.error('Error fetching lesson content:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึงข้อมูล LevelTestTwo ของบทเรียนนี้
  router.get('/leveltesttwo/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name,
          lesson_id
        `)
        .eq('lesson_id', lessonId);

      if (error) {
        throw error;
      }

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      console.error('Error fetching level test two for lesson:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึงข้อมูล LevelTestThree ของบทเรียนนี้
  router.get('/leveltestthree/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      const { data, error } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name,
          lesson_id
        `)
        .eq('lesson_id', lessonId);

      if (error) {
        throw error;
      }

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      console.error('Error fetching level test three for lesson:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET: ดึงชื่อแบบทดสอบทั้งหมดสำหรับบทเรียนนี้ (LevelTestTwo, LevelTestThree, Posttest)
  router.get('/test-names/lesson/:lessonId', async (req, res) => {
    const { lessonId } = req.params;

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ error: 'Valid Lesson ID is required' });
    }

    try {
      // ดึงข้อมูล lesson เพื่อหา thaiinstrument_id
      const { data: lessonData, error: lessonError } = await supabase
        .from('lesson_instrument')
        .select('thaiinstrument_id')
        .eq('lesson_id', lessonId)
        .single();

      if (lessonError) {
        throw lessonError;
      }

      const thaiinstrumentId = lessonData.thaiinstrument_id;

      // ดึงข้อมูล LevelTestTwo
      const { data: levelTestTwoData, error: levelTestTwoError } = await supabase
        .from('leveltesttwo_instrument')
        .select(`
          leveltesttwo_id,
          leveltwo_name
        `)
        .eq('lesson_id', lessonId);

      if (levelTestTwoError) {
        throw levelTestTwoError;
      }

      // ดึงข้อมูล LevelTestThree
      const { data: levelTestThreeData, error: levelTestThreeError } = await supabase
        .from('leveltestthree_instrument')
        .select(`
          leveltestthree_id,
          levelthree_name
        `)
        .eq('lesson_id', lessonId);

      if (levelTestThreeError) {
        throw levelTestThreeError;
      }

      // ดึงข้อมูล Posttest
      const { data: posttestData, error: posttestError } = await supabase
        .from('posttest_instrument')
        .select(`
          posttest_id,
          posttest_name
        `)
        .eq('instrument_id', thaiinstrumentId);

      if (posttestError) {
        throw posttestError;
      }

      // ส่งข้อมูลกลับ
      res.status(200).json({
        success: true,
        data: {
          levelTestTwo: levelTestTwoData && levelTestTwoData.length > 0 ? {
            id: levelTestTwoData[0].leveltesttwo_id,
            name: levelTestTwoData[0].leveltwo_name
          } : null,
          levelTestThree: levelTestThreeData && levelTestThreeData.length > 0 ? {
            id: levelTestThreeData[0].leveltestthree_id,
            name: levelTestThreeData[0].levelthree_name
          } : null,
          posttest: posttestData && posttestData.length > 0 ? {
            id: posttestData[0].posttest_id,
            name: posttestData[0].posttest_name
          } : null
        }
      });
    } catch (err) {
      console.error('Error fetching test names for lesson:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
};
