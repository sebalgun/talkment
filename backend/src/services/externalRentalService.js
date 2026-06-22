import { EXTERNAL_SHEET_NAMES } from '../constants/externalSheetNames.js';
import { fetchSheetRows, updateCellByHeader } from './googleSheets.js';

const today = () => new Date().toISOString().slice(0, 10);

/** 외부인 대여 전체 목록 */
export async function fetchExternalRentals() {
  return fetchSheetRows(EXTERNAL_SHEET_NAMES.RENTALS);
}

/** 미반납 외부인 대여 검색 */
export async function searchExternalUnreturned(query) {
  const rows = await fetchExternalRentals();
  const q = String(query || '').trim();
  if (!q) return [];

  const fields = [
    '담당자 이름',
    '담당자 팀',
    '업체명',
    '장비모델',
    '장비 시리얼',
    '모듈',
    '모듈 시리얼',
    '사업내용',
  ];

  return rows
    .filter((r) => !r['반납일'])
    .filter((r) => fields.some((f) => r[f] && String(r[f]).includes(q)))
    .map((r) => ({ ...r, _type: 'external' }));
}

/** 외부인 대여 반납 처리 */
export async function processExternalReturn(item) {
  const returnDate = today();
  await updateCellByHeader(EXTERNAL_SHEET_NAMES.RENTALS, item._rowIndex, '반납일', returnDate);
  await updateCellByHeader(EXTERNAL_SHEET_NAMES.RENTALS, item._rowIndex, '상태', '반납완료');
  return { rowIndex: item._rowIndex, returnDate };
}
