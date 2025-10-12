const express = require('express');
const authenticateToken = require('../User/middleware/authenticateToken');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

module.exports = (supabase, supabaseStorage) => {
  const router = express.Router();

  // GET: ดึง media ทั้งหมดของ learning
  router.get('/learning/:learningId/media', authenticateToken, requireAdmin, async (req, res) => {
    const { learningId } = req.params;
    const { data, error } = await supabase
      .from('learningmedia_instrument')
      .select('*')
      .eq('learning_id', learningId)
      .order('learningmedia_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่ม media (image/audio) ให้ learning
  router.post('/learning/:learningId/media', authenticateToken, requireAdmin, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]), async (req, res) => {
    const { learningId } = req.params;
    // กรณีส่ง url มาโดยตรง (ไม่ upload)
    const { learningmedia_image, learningmedia_audio } = req.body;
    if (learningmedia_image || learningmedia_audio) {
      // insert url ลงตารางได้เลย
      const newMedia = {
        learning_id: parseInt(learningId),
        learningmedia_image: learningmedia_image || null,
        learningmedia_audio: learningmedia_audio || null
      };
      const { data, error } = await supabase
        .from('learningmedia_instrument')
        .insert([newMedia])
        .select();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(201).json(data[0]);
    }
    // ... เดิม: กรณี upload ไฟล์ใหม่ ...
    const imageFile = req.files['image']?.[0];
    const audioFile = req.files['audio']?.[0];
    const folder = req.body.folder;
    if (!folder || folder === '-') {
      return res.status(400).json({ error: 'ต้องเลือกโฟลเดอร์ก่อนอัปโหลดไฟล์' });
    }
    let imageUrl = null;
    let audioUrl = null;

    if (imageFile) {
      const filePath = `${folder}/${Date.now()}_${imageFile.originalname}`;
      const { error: uploadError } = await supabaseStorage.storage
        .from('image')
        .upload(filePath, imageFile.buffer, { contentType: imageFile.mimetype, upsert: true });
      if (uploadError) {
        return res.status(500).json({ error: `Supabase Storage Error: ${uploadError.message}` });
      }
      imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/image/${filePath}`;
    }
    if (audioFile) {
      const filePath = `${folder}/${Date.now()}_${audioFile.originalname}`;
      const { error: uploadError } = await supabaseStorage.storage
        .from('audio')
        .upload(filePath, audioFile.buffer, { contentType: audioFile.mimetype, upsert: true });
      if (uploadError) {
        return res.status(500).json({ error: `Supabase Storage Error: ${uploadError.message}` });
      }
      audioUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/audio/${filePath}`;
    }

    const newMedia = {
      learning_id: parseInt(learningId),
      learningmedia_image: imageUrl,
      learningmedia_audio: audioUrl
    };
    const { data, error } = await supabase
      .from('learningmedia_instrument')
      .insert([newMedia])
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขชื่อ media
  router.put('/learning/media/:mediaId', authenticateToken, requireAdmin, async (req, res) => {
    const { mediaId } = req.params;
    const { learningmedia_name } = req.body;
    const { data, error } = await supabase
      .from('learningmedia_instrument')
      .update({ learningmedia_name })
      .eq('learningmedia_id', mediaId)
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบ media
  router.delete('/learning/media/:mediaId', authenticateToken, requireAdmin, async (req, res) => {
    const { mediaId } = req.params;
    const { error } = await supabase
      .from('learningmedia_instrument')
      .delete()
      .eq('learningmedia_id', mediaId);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Media deleted successfully' });
  });

  return router;
}; 