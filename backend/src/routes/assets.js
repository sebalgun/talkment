import { Router } from 'express';
import { fetchSheetRows, SHEET_NAMES } from '../services/googleSheets.js';
import { parseSerialAssets, parseSerialLog } from '../services/sheetParser.js';

const router = Router();

/**
 * GET /api/assets
 * 시리얼 물품 마스터 — 상태(available/checkedOut) 포함
 *
 * 출고·반납으로 상태가 자주 바뀌므로 매 요청마다 최신 데이터를 조회한다.
 */
router.get('/', async (_req, res, next) => {
  try {
    const raw = await fetchSheetRows(SHEET_NAMES.SERIAL_ASSETS);
    res.json(parseSerialAssets(raw));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assets/log
 * 시리얼 입출고 이력 — 반납 여부(_isReturned) 포함
 */
router.get('/log', async (_req, res, next) => {
  try {
    const raw = await fetchSheetRows(SHEET_NAMES.SERIAL_LOG);
    res.json(parseSerialLog(raw));
  } catch (err) {
    next(err);
  }
});

export default router;
