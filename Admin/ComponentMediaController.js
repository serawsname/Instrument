const express = require('express');
const authenticateToken = require('../User/middleware/authenticateToken');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Middleware ตรวจสอบ role admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

module.exports = (supabase, supabaseStorage) => {
  const router = express.Router();

  // GET: ดึงส่วนประกอบทั้งหมดของเครื่องดนตรี
  router.get('/instruments/:instrumentId/components', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    const { data, error } = await supabase
      .from('componentmedia_instrument')
      .select('*')
      .eq('thaiinstrument_id', instrumentId)
      .order('componentmedia_id');

    if (error) {
      console.error('Error fetching components:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มส่วนประกอบใหม่
  router.post('/components', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    const { componentmedia_name, thaiinstrument_id } = req.body;
    const file = req.file;
    if (!componentmedia_name || !thaiinstrument_id) {
      console.error('Validation Error: Missing name or instrument ID');
      return res.status(400).json({ error: 'Missing name or instrument ID' });
    }

    let imageUrl = null;
    if (file) {
      const filePath = `components/${Date.now()}_${file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabaseStorage.storage
        .from('image')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
      
      if (uploadError) {
        console.error('❌ Supabase Storage Upload Error:', uploadError.message);
        return res.status(500).json({ error: `Supabase Storage Error: ${uploadError.message}` });
      }
      imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/image/${filePath}`;
    }

    const newComponent = { 
      componentmedia_name, 
      thaiinstrument_id: parseInt(thaiinstrument_id),
      componentmedia_image: imageUrl 
    };
    const { data, error } = await supabase
      .from('componentmedia_instrument')
      .insert([newComponent])
      .select();
      
    if (error) {
      console.error('❌ Supabase Database Insert Error:', error.message);
      return res.status(500).json({ error: `Database Insert Error: ${error.message}` });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขส่วนประกอบ
  router.put('/components/:componentId', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    const { componentId } = req.params;
    const { componentmedia_name } = req.body;
    const file = req.file;

    let updateData = { componentmedia_name };

    if (file) {
      const filePath = `components/${Date.now()}_${file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabaseStorage.storage
        .from('image')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }
      updateData.componentmedia_image = `${process.env.SUPABASE_URL}/storage/v1/object/public/image/${filePath}`;
    }

    const { data, error } = await supabase
      .from('componentmedia_instrument')
      .update(updateData)
      .eq('componentmedia_id', componentId)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบส่วนประกอบ
  router.delete('/components/:componentId', authenticateToken, requireAdmin, async (req, res) => {
    const { componentId } = req.params;
    
    // Optional: Delete image from storage first if you want
    
    const { error } = await supabase
      .from('componentmedia_instrument')
      .delete()
      .eq('componentmedia_id', componentId);
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Component deleted successfully' });
  });

  return router;
}; 