const jwt = require('jsonwebtoken');

function AuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!token) {
    return res.status(401).json({ message: 'ไม่ได้รับ token กรุณาเข้าสู่ระบบ' });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

module.exports = AuthenticateToken;
