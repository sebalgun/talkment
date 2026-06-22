/** 구글 시트 탭 이름 — 시트·코드·검증 API 모두 이 문자열과 정확히 일치해야 함 */
export const SHEET_NAMES = {
  EMPLOYEES: '명단',
  SERIAL_ASSETS: '시리얼 물품 관리',
  SERIAL_LOG: '시리얼 입출고 내역',
  CONSUMABLE_MASTER: '일반 물품 관리',
  CONSUMABLE_LOG: '일반 입출고 내역',
};

export const REQUIRED_SHEET_TABS = Object.values(SHEET_NAMES);
