// AdminUser.js - API สำหรับจัดการ user (เฉพาะ admin)
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

  // GET: ดู user ทั้งหมด
  router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('user')
      .select('user_id, username, email, phone, age, role')
      .order('user_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  // GET: ดูข้อมูลผู้ใช้ปัจจุบันจาก token
  router.get('/current-user', authenticateToken, async (req, res) => {
    try {
      // JWT token ใช้ 'sub' field สำหรับ user_id
      const userId = req.user?.sub || req.user?.user_id;
      
      if (!req.user || !userId) {
        return res.status(400).json({ error: 'ไม่พบ user_id ใน token' });
      }
      
      const { data, error } = await supabase
        .from('user')
        .select('user_id, username, email, phone, age, role')
        .eq('user_id', userId)
        .single();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      if (!data) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
    }
  });

  // POST: เพิ่ม user ใหม่
  router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password, phone, email, age, role } = req.body;
    const { data, error } = await supabase
      .from('user')
      .insert([{ username, password, phone, email, age, role }])
      .select('user_id');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json({ user_id: data[0].user_id });
  });

  // PUT: แก้ไข user ตาม user_id
  router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, phone, email, age, role } = req.body;
    const { error } = await supabase
      .from('user')
      .update({ username, phone, email, age, role })
      .eq('user_id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'User updated' });
  });

  // DELETE: ลบ user ตาม user_id
  router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from('user')
      .delete()
      .eq('user_id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'User deleted' });
  });

  return router;
};