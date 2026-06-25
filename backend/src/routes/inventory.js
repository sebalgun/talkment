import { Router } from 'express';
import { getInventory } from '../services/inventoryService.js';

const router = Router();

/**
 * GET /api/inventory
 * 통합 재고 목록 — [물품관리] 우선, 구 탭 폴백
 */
router.get('/', async (_req, res, next) => {
  try {
    const items = await getInventory();
    res.json(items);
  } catch (e) {
    next(e);
  }
});

export default router;
