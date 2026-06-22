import {
  fetchSheetRows,
  SHEET_NAMES,
} from './googleSheets.js';
import { processSerialReturn } from './checkoutService.js';

/** 미반납 항목 검색 (시리얼 입출고 이력) */
export async function searchUnreturned(query) {
  const serialRows = await fetchSheetRows(SHEET_NAMES.SERIAL_LOG);

  return serialRows
    .filter((r) => !String(r['반납일'] || '').trim())
    .filter(
      (r) =>
        (r['출고자'] && r['출고자'].includes(query)) ||
        (r['항목'] && r['항목'].includes(query)) ||
        (r['시리얼 넘버'] && r['시리얼 넘버'].includes(query))
    )
    .map((r) => ({ ...r, _type: 'serial' }));
}

/** 반납 처리 */
export async function processReturn(item) {
  if (item._type === 'serial') {
    return processSerialReturn(item);
  }
  throw new Error('반납 가능한 항목이 아닙니다.');
}
