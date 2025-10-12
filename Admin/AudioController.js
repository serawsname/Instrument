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

  // GET: ดึงไฟล์เสียงทั้งหมดของเครื่องดนตรี
  router.get('/instruments/:instrumentId/audios', authenticateToken, requireAdmin, async (req, res) => {
    const { instrumentId } = req.params;
    const { data, error } = await supabase
      .from('audio_instrument')
      .select('*')
      .eq('thaiinstrument_id', instrumentId)
      .order('audio_id');

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // POST: เพิ่มไฟล์เสียงใหม่
  router.post('/audios', authenticateToken, requireAdmin, upload.single('audio'), async (req, res) => {
    const { audio_name, thaiinstrument_id, folder, frequency_hz } = req.body;
    const file = req.file;

    if (!audio_name || !thaiinstrument_id || !file || !folder || folder === '-') {
      return res.status(400).json({ error: 'Missing name, instrument ID, audio file, or folder' });
    }

    const filePath = `${folder}/${Date.now()}_${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseStorage.storage
      .from('audio')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) {
      return res.status(500).json({ error: `Supabase Storage Error: ${uploadError.message}` });
    }
    const audioUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/audio/${filePath}`;
    
    // Prepare insert data with optional frequency_hz
    const insertData = { 
      audio_name, 
      thaiinstrument_id: parseInt(thaiinstrument_id),
      audio_address: audioUrl 
    };
    
    // Add frequency_hz if provided and valid
    if (frequency_hz && !isNaN(parseFloat(frequency_hz))) {
      insertData.frequency_hz = parseFloat(frequency_hz);
    }
    
    const { data, error } = await supabase
      .from('audio_instrument')
      .insert([insertData])
      .select();
    if (error) {
      return res.status(500).json({ error: `Database Insert Error: ${error.message}` });
    }
    res.status(201).json(data[0]);
  });

  // PUT: แก้ไขชื่อไฟล์เสียงและ frequency_hz
  router.put('/audios/:audioId', authenticateToken, requireAdmin, async (req, res) => {
    const { audioId } = req.params;
    const { audio_name, frequency_hz } = req.body;

    if (!audio_name) {
      return res.status(400).json({ error: 'Missing audio_name' });
    }

    // Prepare update data
    const updateData = { audio_name };
    
    // Add frequency_hz if provided (including null to clear the value)
    if (frequency_hz !== undefined) {
      if (frequency_hz === null || frequency_hz === '') {
        updateData.frequency_hz = null;
      } else if (!isNaN(parseFloat(frequency_hz))) {
        updateData.frequency_hz = parseFloat(frequency_hz);
      }
    }

    const { data, error } = await supabase
      .from('audio_instrument')
      .update(updateData)
      .eq('audio_id', audioId)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data[0]);
  });

  // DELETE: ลบไฟล์เสียง
  router.delete('/audios/:audioId', authenticateToken, requireAdmin, async (req, res) => {
    const { audioId } = req.params;

    // Delete from database เท่านั้น ไม่ต้องลบใน storage
    const { error: deleteDbError } = await supabase
      .from('audio_instrument')
      .delete()
      .eq('audio_id', audioId);
    
    if (deleteDbError) {
      return res.status(500).json({ error: deleteDbError.message });
    }

    res.json({ message: 'Audio deleted from database only' });
  });

  // GET: ดึงรายชื่อโฟลเดอร์ใน bucket audio
  router.get('/audios/list-folders', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabaseStorage.storage
        .from('audio')
        .list('', { limit: 100, offset: 0 });
      if (error) return res.status(500).json({ error: error.message });
      // ส่งกลับทั้ง data เพื่อ debug
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: สร้างโฟลเดอร์เปล่าๆ ใน bucket audio
  router.post('/audios/create-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'No folder name provided' });
    const filePath = `${folder}/.keep`;
    const { data, error } = await supabaseStorage.storage
      .from('audio')
      .upload(filePath, '', { contentType: 'text/plain', upsert: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Folder created', folder });
  });

  // GET: ดึงรายชื่อไฟล์ในโฟลเดอร์ของ bucket audio
  router.get('/audios/list-files', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.query;
    try {
      const { data, error } = await supabaseStorage.storage
        .from('audio')
        .list(folder || '', { limit: 100, offset: 0 });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: เปลี่ยนชื่อโฟลเดอร์ใน bucket audio
  router.post('/audios/rename-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { oldFolder, newFolder } = req.body;
    if (!oldFolder || !newFolder) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    }
    try {
      // 1. list ไฟล์ทั้งหมดในโฟลเดอร์เดิม
      const { data: files, error: listError } = await supabaseStorage.storage
        .from('audio')
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
          .from('audio')
          .download(oldPath);
        if (downloadError || !fileData) {
          return res.status(500).json({ error: downloadError?.message || 'ไม่พบไฟล์เดิม' });
        }
        const { error: uploadError } = await supabaseStorage.storage
          .from('audio')
          .upload(newPath, fileData, { upsert: true });
        if (uploadError) {
          return res.status(500).json({ error: uploadError.message });
        }
      }
      // 3. ลบไฟล์ทั้งหมดในโฟลเดอร์เดิม
      const paths = files.map(f => `${oldFolder}/${f.name}`);
      const { error: removeError } = await supabaseStorage.storage
        .from('audio')
        .remove(paths);
      if (removeError) return res.status(500).json({ error: removeError.message });
      res.json({ message: 'เปลี่ยนชื่อโฟลเดอร์สำเร็จ', oldFolder, newFolder });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์ (bucket audio)
  router.post('/audios/delete-folder', authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'No folder name provided' });
    try {
      const { data: files, error: listError } = await supabaseStorage.storage
        .from('audio')
        .list(folder, { limit: 1000 });
      if (listError) return res.status(500).json({ error: listError.message });
      if (!files || files.length === 0) {
        return res.json({ message: 'Folder already empty', folder });
      }
      const paths = files.map(f => `${folder}/${f.name}`);
      const { data: removeData, error: removeError } = await supabaseStorage.storage
        .from('audio')
        .remove(paths);
      if (removeError) return res.status(500).json({ error: removeError.message });
      res.json({ message: 'Folder deleted', folder, files: paths });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: เปลี่ยนชื่อไฟล์เสียงในโฟลเดอร์
  router.post('/audios/rename-file', authenticateToken, requireAdmin, async (req, res) => {
    const { folder, oldName, newName } = req.body;
    if (!folder || !oldName || !newName) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    }
    const oldPath = `${folder}/${oldName}`;
    const newPath = `${folder}/${newName}`;
    try {
      // 1. download ไฟล์เดิม
      const { data: fileData, error: downloadError } = await supabaseStorage.storage
        .from('audio')
        .download(oldPath);
      if (downloadError || !fileData) {
        return res.status(500).json({ error: downloadError?.message || 'ไม่พบไฟล์เดิม' });
      }
      // 2. upload ไฟล์ใหม่
      const { error: uploadError } = await supabaseStorage.storage
        .from('audio')
        .upload(newPath, fileData, { upsert: true });
      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }
      // 3. ลบไฟล์เก่า
      const { error: removeError } = await supabaseStorage.storage
        .from('audio')
        .remove([oldPath]);
      if (removeError) {
        return res.status(500).json({ error: removeError.message });
      }
      // 4. อัปเดต audio_address ในฐานข้อมูล
      const oldAudioUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/audio/${oldPath}`;
      const newAudioUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/audio/${newPath}`;
      const { error: updateError } = await supabase
        .from('audio_instrument')
        .update({ audio_address: newAudioUrl })
        .eq('audio_address', oldAudioUrl);
      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }
      res.json({ message: 'เปลี่ยนชื่อไฟล์สำเร็จ', oldPath, newPath });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: insert audio record for existing file
  router.post('/audios/insert-existing', authenticateToken, requireAdmin, async (req, res) => {
    const { audio_name, thaiinstrument_id, folder, audio_address, frequency_hz } = req.body;
    if (!audio_name || !thaiinstrument_id || !folder || !audio_address) {
      return res.status(400).json({ error: 'Missing name, instrument ID, audio_address, or folder' });
    }
    
    // Prepare insert data with optional frequency_hz
    const insertData = { 
      audio_name, 
      thaiinstrument_id: parseInt(thaiinstrument_id),
      audio_address
    };
    
    // Add frequency_hz if provided and valid
    if (frequency_hz && !isNaN(parseFloat(frequency_hz))) {
      insertData.frequency_hz = parseFloat(frequency_hz);
    }
    
    const { data, error } = await supabase
      .from('audio_instrument')
      .insert([insertData])
      .select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  });

  // POST: ลบไฟล์ในโฟลเดอร์ (bucket audio)
  router.post('/audios/delete-file', authenticateToken, requireAdmin, async (req, res) => {
    const { path } = req.body; // path เช่น 'Pin/xxx.mp3'
    if (!path) return res.status(400).json({ error: 'No file path provided' });
    const { data, error } = await supabaseStorage.storage
      .from('audio')
      .remove([path]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'File deleted', path });
  });

  // DELETE: ลบ record ใน audio_instrument ด้วย audio_address
  router.delete('/audios/delete-by-url', authenticateToken, requireAdmin, async (req, res) => {
    const { audio_address } = req.body;
    if (!audio_address) return res.status(400).json({ error: 'No audio_address provided' });
    const { error } = await supabase
      .from('audio_instrument')
      .delete()
      .eq('audio_address', audio_address);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Audio record deleted by url', audio_address });
  });

  // POST: อัพโหลดไฟล์เสียงเข้าโฟลเดอร์ (ไม่ผูก instrument_id)
  router.post('/audios/upload-file', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    const folder = req.body.folder;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!folder) return res.status(400).json({ error: 'No folder specified' });

    const filePath = `${folder}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabaseStorage.storage
      .from('audio')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) {
      return res.status(500).json({ error: `Supabase Storage Error: ${uploadError.message}` });
    }
    const audioUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/audio/${filePath}`;
    res.status(200).json({ url: audioUrl });
  });

  return router;
};