/** 구글 시트 탭 이름 — backend/src/constants/sheetNames.js 와 동일 */
export const SHEET_TAB_NAMES = {
  EMPLOYEES: '명단',
  SERIAL_ASSETS: '시리얼 물품 관리',
  SERIAL_LOG: '시리얼 입출고 내역',
  CONSUMABLE_MASTER: '일반 물품 관리',
  CONSUMABLE_LOG: '일반 입출고 내역',
};

export const REQUIRED_SHEET_TABS = Object.values(SHEET_TAB_NAMES);

/** 구글 시트 탭 만들 때 복사용 */
export const SHEET_TAB_COPY_LIST = REQUIRED_SHEET_TABS.join('\n');
