// AudioInstrument.js (ฉบับแก้ไข)
const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
  // เปลี่ยน Endpoint ให้รับ instrumentId และ note
  // GET /audio/:instrumentId/:note
  router.get('/:instrumentId/:note', async (req, res) => {
    // รับค่าจาก params ทั้งสองตัว
    const instrumentId = req.params.instrumentId;
    const note = req.params.note;

    // ตรวจสอบว่าได้ค่าครบหรือไม่
    if (!instrumentId || !note) {
      return res.status(400).json({ error: 'Instrument ID and note are required' });
    }

    // แก้ไขคำสั่ง query ให้ค้นหาจาก cả instrumentId และ audio_name
    const { data, error } = await supabase
      .from('audio_instrument')
      .select('audio_address')
      .eq('thaiinstrument_id', instrumentId) // ค้นหาด้วย ID ของเครื่องดนตรี
      .eq('audio_name', note)               // และค้นหาด้วยชื่อโน้ต
      .limit(1); // ใช้ limit(1) แทน single() เพื่อให้ได้แค่ 1 รายการแรก

    if (error) {
      console.error('Error fetching audio:', error);
      return res.status(500).json({ error: 'Database error occurred' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Audio not found for the specified instrument and note' });
    }

    return res.json({ url: data[0].audio_address });
  });

  // GET /frequency/:instrumentId/:note - ดึงข้อมูล frequency_hz
  router.get('/frequency/:instrumentId/:note', async (req, res) => {
    const instrumentId = req.params.instrumentId;
    const note = req.params.note;

    if (!instrumentId || !note) {
      return res.status(400).json({ error: 'Instrument ID and note are required' });
    }

    const { data, error } = await supabase
      .from('audio_instrument')
      .select('frequency_hz')
      .eq('thaiinstrument_id', instrumentId)
      .eq('audio_name', note)
      .limit(1);

    if (error) {
      console.error('Error fetching frequency:', error);
      return res.status(500).json({ error: 'Database error occurred' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Frequency not found for the specified instrument and note' });
    }

    return res.json({ frequency_hz: data[0].frequency_hz });
  });

  return router;
};