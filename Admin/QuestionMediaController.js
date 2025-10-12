const express = require('express');

module.exports = function(supabase) {
  const router = express.Router();

  // GET: ดึง media ของทุก question
  router.get('/question/all/media', async (req, res) => {
    const { data, error } = await supabase
      .from('questionmedia_instrument')
      .select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // GET: ดึง media ทั้งหมดของคำถาม
  router.get('/question/:questionTextId/media', async (req, res) => {
    const { questionTextId } = req.params;
    const { data, error } = await supabase
      .from('questionmedia_instrument')
      .select('*')
      .eq('questionstext_id', questionTextId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่ม media ให้คำถาม
  router.post('/question/:questionTextId/media', async (req, res) => {
    const { questionTextId } = req.params;
    const { questionmedia_image, questionmedia_audio } = req.body;
    const { data, error } = await supabase
      .from('questionmedia_instrument')
      .insert([
        {
          questionstext_id: questionTextId,
          questionmedia_image,
          questionmedia_audio,
        },
      ])
      .single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  });

  // DELETE: ลบ media
  router.delete('/question/media/:mediaId', async (req, res) => {
    const { mediaId } = req.params;
    const { error } = await supabase
      .from('questionmedia_instrument')
      .delete()
      .eq('questionmedia_id', mediaId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  });

  return router;
}; 