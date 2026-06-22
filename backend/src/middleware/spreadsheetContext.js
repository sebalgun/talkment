import { AsyncLocalStorage } from 'async_hooks';
import { config } from '../config/env.js';
import { INVENTORY_MODES } from '../constants/inventoryModes.js';

export const spreadsheetStore = new AsyncLocalStorage();

export function getSpreadsheetId() {
  const fromRequest = spreadsheetStore.getStore()?.spreadsheetId;
  const id = fromRequest || config.google.spreadsheetId;
  if (!id) {
    throw new Error('스프레드시트 ID가 설정되지 않았습니다. 앱에서 구글 시트를 등록해 주세요.');
  }
  return id;
}

export function getInventoryMode() {
  const mode = spreadsheetStore.getStore()?.inventoryMode;
  return mode === INVENTORY_MODES.EXTERNAL ? INVENTORY_MODES.EXTERNAL : INVENTORY_MODES.INTERNAL;
}

/** API 요청마다 X-Spreadsheet-Id + X-Inventory-Mode 헤더 또는 .env 기본값 적용 */
export function spreadsheetMiddleware(req, res, next) {
  if (req.originalUrl.startsWith('/api/app-config') || req.originalUrl.startsWith('/api/config/')) {
    return next();
  }
  const id = req.headers['x-spreadsheet-id'] || config.google.spreadsheetId;
  if (!id) {
    return res.status(400).json({
      code: 'NO_SPREADSHEET',
      error: '스프레드시트 ID가 필요합니다. 앱에서 구글 시트 주소를 등록해 주세요.',
    });
  }
  const rawMode = String(req.headers['x-inventory-mode'] || INVENTORY_MODES.INTERNAL).toLowerCase();
  const inventoryMode =
    rawMode === INVENTORY_MODES.EXTERNAL ? INVENTORY_MODES.EXTERNAL : INVENTORY_MODES.INTERNAL;
  spreadsheetStore.run({ spreadsheetId: id, inventoryMode }, () => next());
}

/** URL 또는 ID 문자열에서 스프레드시트 ID 추출 */
export function parseSpreadsheetId(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;

  return null;
}
