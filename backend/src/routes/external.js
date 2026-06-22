import { Router } from 'express';
import { fetchExternalRentals } from '../services/externalRentalService.js';

const router = Router();

/** 외부인 대여 목록 (캐시 없이 실시간 조회) */
router.get('/rentals', async (_req, res, next) => {
  try {
    const items = await fetchExternalRentals();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

export default router;
