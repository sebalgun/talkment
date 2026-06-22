import { Router } from 'express';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { masterStore } from '../services/masterDataStore.js';

const router = Router();

/**
 * GET /api/employees
 * 직원 명단 반환 (5분 캐시)
 *
 * Query:
 *   ?refresh=1  — 캐시를 무시하고 시트에서 즉시 재조회
 */
router.get('/', async (req, res, next) => {
  try {
    const spreadsheetId = getSpreadsheetId();
    const force = req.query.refresh === '1';
    const employees = await masterStore.loadEmployees(spreadsheetId, { force });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

export default router;
