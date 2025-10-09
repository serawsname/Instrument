const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // GET all instruments with images
  router.get('/images', async (req, res) => {
    const { data, error } = await supabase
      .from('image_instrument')
      .select(`
        image_address,
        thai_instrument (
          thaiinstrument_id,
          thaiinstrument_name,
          thaiinstrument_type
        )
      `);

    if (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลรูปภาพ:", error.message);
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'success', data });
  });

  // GET specific instrument by ID
  router.get('/instrument/:id', async (req, res) => {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('image_instrument')
      .select(`
        image_address,
        thai_instrument (
          thaiinstrument_id,
          thaiinstrument_name,
          thaiinstrument_type,
          flutter_page_name
        )
      `)
      .eq('thaiinstrument_id', id)
      .single();

    if (error) {
      console.error(`เกิดข้อผิดพลาดในการดึงข้อมูลเครื่องดนตรี ID ${id}:`, error.message);
      return res.status(404).json({ status: 'error', message: 'ไม่พบเครื่องดนตรีที่ระบุ' });
    }

    res.json({ status: 'success', data });
  });

  return router;
};
