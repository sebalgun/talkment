import { Router } from 'express';
import { processCheckout } from '../services/checkoutService.js';

const router = Router();

/** 출고 확정 (서명 전 데이터 등록) */
router.post('/', async (req, res, next) => {
  try {
    const { parsed, employee } = req.body;
    if (!parsed || !employee) {
      return res.status(400).json({ error: 'parsed, employee 필드가 필요합니다.' });
    }
    const result = await processCheckout(parsed, employee);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
