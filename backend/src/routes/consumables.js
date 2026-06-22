import { Router } from 'express';
import { fetchSheetRows, SHEET_NAMES } from '../services/googleSheets.js';
import { parseConsumableAssets, parseConsumableLog } from '../services/sheetParser.js';

const router = Router();

/**
 * GET /api/consumables/master
 * 소모품 마스터 — 잔여 수량(_remaining) 및 재고 여부(_hasStock) 포함
 */
router.get('/master', async (_req, res, next) => {
  try {
    const raw = await fetchSheetRows(SHEET_NAMES.CONSUMABLE_MASTER);
    res.json(parseConsumableAssets(raw));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/consumables/log
 * 소모품 입출고 이력 — 수량(_quantity) 숫자 타입 포함
 */
router.get('/log', async (_req, res, next) => {
  try {
    const raw = await fetchSheetRows(SHEET_NAMES.CONSUMABLE_LOG);
    res.json(parseConsumableLog(raw));
  } catch (err) {
    next(err);
  }
});

export default router;
