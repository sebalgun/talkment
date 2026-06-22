import { Router } from 'express';
import { getDashboardStats } from '../services/dashboardService.js';

const router = Router();

router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

export default router;
