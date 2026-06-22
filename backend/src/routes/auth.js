import express from 'express';
import { authenticateUser } from '../services/authService.js';

const router = express.Router();

router.post('/verify', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken이 필요합니다.' });
    const result = await authenticateUser(idToken);
    res.json(result);
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message, code: 'ACCESS_DENIED' });
    }
    next(err);
  }
});

export default router;
