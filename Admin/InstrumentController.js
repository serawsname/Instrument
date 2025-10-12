const express = require('express');
const authenticateToken = require('../User/middleware/authenticateToken');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { createClient } = require('@supabase/supabase-js');

// Middleware ตรวจสอบ role admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
}

// รับ supabaseStorage จาก index.js
module.exports = (supabase, supabaseStorage) => {
  const router = express.Router();

  // GET: ดึงรายชื่อไฟล์ในโฟลเดอร์
  router.get('/instruments/list-files', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.query;
    try {
      const { data, error } = await supabaseStorage.storage
        .from('image')
        .list(folder || '', { limit: 100, offset: 0 });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: ลบไฟล์ในโฟลเดอร์
  router.post('/instruments/delete-file', authenticateToken, requireAdmin, async (req, res) => {
    const { path } = req.body; // path เช่น 'Khaen/xxx.jpg'
    const { data, error } = await supabaseStorage.storage
      .from('image')
      .remove([path]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'File deleted', path });
  });

  // GET: ดู instrument ทั้งหมด
  router.get('/instruments', authenticateToken, requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('thai_instrument')
      .select('thaiinstrument_id, thaiinstrument_name, thaiinstrument_type, image_instrument:image_instrument(image_address)')
      .order('thaiinstrument_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // map image_address ออกมาเป็น imageUrl (flatten)
    const result = data.map(item => ({
      ...item,
      imageUrl: item.image_instrument && item.image_instrument.length > 0 ? item.image_instrument[0].image_address : null
    }));
    res.json(result);
  });

  // POST: เพิ่ม instrument ใหม่
  router.post('/instruments', authenticateToken, requireAdmin, async (req, res) => {
    const { thaiinstrument_name, thaiinstrument_type, flutter_page_name = 'Kongwongyai' } = req.body;
    const { data, error } = await supabase
      .from('thai_instrument')
      .insert([{ thaiinstrument_name, thaiinstrument_type, flutter_page_name }])
      .select('thaiinstrument_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json({ thaiinstrument_id: data[0].thaiinstrument_id });
  });

  // PUT: แก้ไข instrument ตาม id
  router.put('/instruments/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { thaiinstrument_name, thaiinstrument_type, flutter_page_name } = req.body;
    const { error } = await supabase
      .from('thai_instrument')
      .update({ thaiinstrument_name, thaiinstrument_type, flutter_page_name })
      .eq('thaiinstrument_id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Instrument updated' });
  });

  // DELETE: ลบ instrument ตาม id
  router.delete('/instruments/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from('thai_instrument')
      .delete()
      .eq('thaiinstrument_id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Instrument deleted' });
  });

  // POST: อัพโหลดภาพ
  router.post('/instruments/upload-image', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    const { thaiinstrument_id, folder } = req.body;
    const file = req.file;
    if (!file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ถ้าไม่ได้ส่ง folder มา ให้ default เป็น instrument_images
    const folderName = folder || 'instrument_images';
    const filePath = `${folderName}/${Date.now()}_${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseStorage.storage
      .from('image')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) {
      console.error('Supabase upload error:', uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/image/${filePath}`;
    // --- แก้ไขตรงนี้: insert ทุกครั้ง ---
    const { error: insertError } = await supabase
      .from('image_instrument')
      .insert([{ image_address: imageUrl, thaiinstrument_id: parseInt(thaiinstrument_id) }]);
    if (insertError) {
      console.error('Supabase insert error:', insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ imageUrl });
  });

  // POST: สร้างโฟลเดอร์เปล่าๆ
  router.post('/instruments/create-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'No folder name provided' });
    const filePath = `${folder}/.keep`;
    const { data, error } = await supabaseStorage.storage
      .from('image')
      .upload(filePath, Buffer.from(''), { contentType: 'text/plain', upsert: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Folder created', folder });
  });

  // POST: ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์
  router.post('/instruments/delete-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'No folder name provided' });
    try {
      // 1. list ไฟล์ทั้งหมดในโฟลเดอร์
      const { data: files, error: listError } = await supabaseStorage.storage
        .from('image')
        .list(folder, { limit: 1000 });
      if (listError) return res.status(500).json({ error: listError.message });
      if (!files || files.length === 0) {
        return res.json({ message: 'Folder already empty', folder });
      }
      // 2. เตรียม path สำหรับลบ
      const paths = files.map(f => `${folder}/${f.name}`);
      // 3. ลบไฟล์ทั้งหมด
      const { data: removeData, error: removeError } = await supabaseStorage.storage
        .from('image')
        .remove(paths);
      if (removeError) return res.status(500).json({ error: removeError.message });
      res.json({ message: 'Folder deleted', folder, files: paths });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: เปลี่ยนชื่อไฟล์ในโฟลเดอร์
  router.post('/instruments/rename-file', authenticateToken, requireAdmin, async (req, res) => {
    const { folder, oldName, newName } = req.body;
    if (!folder || !oldName || !newName) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    }
    const oldPath = `${folder}/${oldName}`;
    const newPath = `${folder}/${newName}`;
    try {
      // 1. download ไฟล์เดิม
      const { data: fileData, error: downloadError } = await supabaseStorage.storage
        .from('image')
        .download(oldPath);
      if (downloadError || !fileData) {
        return res.status(500).json({ error: downloadError?.message || 'ไม่พบไฟล์เดิม' });
      }
      // 2. upload ไฟล์ใหม่
      const { error: uploadError } = await supabaseStorage.storage
        .from('image')
        .upload(newPath, fileData, { upsert: true });
      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }
      // 3. ลบไฟล์เก่า
      const { error: removeError } = await supabaseStorage.storage
        .from('image')
        .remove([oldPath]);
      if (removeError) {
        return res.status(500).json({ error: removeError.message });
      }
      res.json({ message: 'เปลี่ยนชื่อไฟล์สำเร็จ', oldPath, newPath });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: set image url จากไฟล์ในโฟลเดอร์ (ไม่อัปโหลดใหม่)
  router.post('/instruments/set-image-url', authenticateToken, requireAdmin, async (req, res) => {
    const { thaiinstrument_id, imageUrl } = req.body;
    if (!thaiinstrument_id || !imageUrl) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    }
    try {
      // ตรวจสอบว่ามี record เดิมหรือยัง
      const { data: exist, error: checkError } = await supabase
        .from('image_instrument')
        .select('image_id')
        .eq('thaiinstrument_id', thaiinstrument_id)
        .maybeSingle();
      if (checkError) return res.status(500).json({ error: checkError.message });
      if (exist) {
        // update
        const { error: updateError } = await supabase
          .from('image_instrument')
          .update({ image_address: imageUrl })
          .eq('thaiinstrument_id', thaiinstrument_id);
        if (updateError) return res.status(500).json({ error: updateError.message });
      } else {
        // insert
        const { error: insertError } = await supabase
          .from('image_instrument')
          .insert([{ thaiinstrument_id: parseInt(thaiinstrument_id), image_address: imageUrl }]);
        if (insertError) return res.status(500).json({ error: insertError.message });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: อัพโหลดไฟล์ (ภาพหรือเสียง)
  router.post('/instruments/upload-file', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    const file = req.file;
    const folder = req.body.folder;
    if (!file || !folder) {
      return res.status(400).json({ error: 'Missing file or folder' });
    }
    // แยกประเภทไฟล์
    let bucket = 'image';
    if (file.mimetype.startsWith('audio/')) bucket = 'audio';
    const filePath = `${folder}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabaseStorage.storage
      .from(bucket)
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }
    res.json({ success: true, url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}` });
  });

  // POST: เปลี่ยนชื่อโฟลเดอร์ (simulate by copy all files then delete old)
  router.post('/instruments/rename-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { oldFolder, newFolder } = req.body;
    if (!oldFolder || !newFolder) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    }
    try {
      // 1. list ไฟล์ทั้งหมดในโฟลเดอร์เดิม
      const { data: files, error: listError } = await supabaseStorage.storage
        .from('image')
        .list(oldFolder, { limit: 1000 });
      if (listError) return res.status(500).json({ error: listError.message });
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'โฟลเดอร์เดิมว่างเปล่า' });
      }
      // 2. copy ไฟล์ทั้งหมดไปยังโฟลเดอร์ใหม่
      for (const f of files) {
        const oldPath = `${oldFolder}/${f.name}`;
        const newPath = `${newFolder}/${f.name}`;
        const { data: fileData, error: downloadError } = await supabaseStorage.storage
          .from('image')
          .download(oldPath);
        if (downloadError || !fileData) {
          return res.status(500).json({ error: downloadError?.message || 'ไม่พบไฟล์เดิม' });
        }
        const { error: uploadError } = await supabaseStorage.storage
          .from('image')
          .upload(newPath, fileData, { upsert: true });
        if (uploadError) {
          return res.status(500).json({ error: uploadError.message });
        }
      }
      // 3. ลบไฟล์ทั้งหมดในโฟลเดอร์เดิม
      const paths = files.map(f => `${oldFolder}/${f.name}`);
      const { error: removeError } = await supabaseStorage.storage
        .from('image')
        .remove(paths);
      if (removeError) return res.status(500).json({ error: removeError.message });
      res.json({ message: 'เปลี่ยนชื่อโฟลเดอร์สำเร็จ', oldFolder, newFolder });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
