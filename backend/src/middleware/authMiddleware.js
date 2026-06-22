import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '세션이 만료되었습니다. 다시 로그인해 주세요.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({ error: '유효하지 않은 세션입니다.', code: 'TOKEN_INVALID' });
  }
}
