const express = require('express');
const otpStore = require('./OtpStore'); // สมมติว่าไฟล์นี้อยู่ในระดับเดียวกัน
const nodemailer = require('nodemailer');

module.exports = (supabase) => {
  const router = express.Router();

  // ตรวจสอบว่ามี Environment Variables ครบถ้วนหรือไม่
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ Critical Error: Missing EMAIL_USER or EMAIL_PASS in .env file.");
    // ใน production อาจจะโยน error เพื่อหยุดการทำงานของ server
    // throw new Error("Email configuration is missing.");
  }
  
  // ตั้งค่า Nodemailer Transporter
  const transporter = nodemailer.createTransport({
    // ⭐️ ใช้ host แทน service เพื่อความแม่นยำ
    host: 'smtp.gmail.com', 
    port: 587, // Port สำหรับ TLS/STARTTLS
    secure: false, // true สำหรับ port 465, false สำหรับ port อื่นๆ
    auth: {
      user: process.env.EMAIL_USER, // อีเมลผู้ส่ง (เช่น your-email@gmail.com)
      pass: process.env.EMAIL_PASS, // App Password ที่สร้างจาก Google Account
    },
  });

  router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'กรุณาระบุอีเมล' });
    }

    try {
      // 1. ตรวจสอบว่ามีผู้ใช้ที่ใช้อีเมลนี้ในระบบหรือไม่
      const { data: user, error: userError } = await supabase
        .from('user')
        .select('user_id')
        .eq('email', email)
        .maybeSingle(); // ใช้ maybeSingle() แทน single() เพื่อให้ return null เมื่อไม่พบข้อมูล

      if (userError) {
        console.error('Send OTP user error:', userError);
        return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการตรวจสอบผู้ใช้' });
      }

      if (!user) {
        return res.status(404).json({ status: 'error', message: 'ไม่พบบัญชีผู้ใช้ที่ลงทะเบียนด้วยอีเมลนี้' });
      }

      // 2. สร้าง OTP และเวลาหมดอายุ (5 นาที)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

      // 3. จัดเก็บ OTP ชั่วคราว (ในหน่วยความจำ)
      otpStore[email] = { otp, expiresAt };

      // ⭐️ ชื่อแอปของคุณ สามารถเปลี่ยนได้ที่นี่
      const appName = "Thai Instrument Quiz"; 
      
      // 4. ตั้งค่าและส่งอีเมลด้วย Nodemailer
      const mailOptions = {
        from: `"${appName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `รหัสยืนยันตัวตนสำหรับ ${appName}`,
        html: `
          <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
            <h2 style="color: #4CAF50; text-align: center;">ยืนยันการรีเซ็ตรหัสผ่าน</h2>
            <p>สวัสดีค่ะ,</p>
            <p>เราได้รับคำร้องขอเพื่อรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณในแอปพลิเคชัน <strong>${appName}</strong></p>
            <p>กรุณาใช้รหัส OTP ด้านล่างนี้เพื่อดำเนินการต่อ:</p>
            
            <div style="background-color: #f2f2f2; margin: 20px 0; padding: 15px; text-align: center;">
              <p style="font-size: 28px; font-weight: bold; letter-spacing: 3px; color: #000; margin: 0;">
                ${otp}
              </p>
            </div>
            
            <p style="text-align: center; color: #888;">รหัสนี้จะสามารถใช้งานได้ภายใน <strong>5 นาที</strong>เท่านั้น</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #777;">
              หากคุณไม่ได้เป็นผู้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้ ระบบจะไม่มีการเปลี่ยนแปลงใดๆ กับบัญชีของคุณ
            </p>
            <p style="font-size: 12px; color: #777;">
              ขอขอบคุณที่ใช้บริการ,<br>
              ทีมงาน ${appName}
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ status: 'success', message: 'รหัส OTP ถูกส่งไปยังอีเมลของคุณแล้ว' });

    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      // ในกรณีที่เกิดข้อผิดพลาดในการส่งเมล
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่อีกครั้ง' });
    }
  });

  return router;
};