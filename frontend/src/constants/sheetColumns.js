/** 탭별 컬럼 정의 — backend/src/constants/sheetColumns.js 와 동기화 */
export const SHEET_TAB_CONFIG = {
  employees: {
    label: '명단',
    columns: [
      { key: 'No', editable: false },
      { key: '이름', editable: true },
      { key: '직함', editable: true },
      { key: '소속', editable: true },
      { key: '연락처', editable: true },
      { key: '이메일주소', editable: true },
    ],
  },
  assets: {
    label: '시리얼 물품 관리',
    columns: [
      { key: 'No', editable: false },
      { key: '항목', editable: true },
      { key: '시리얼 넘버', editable: true },
      { key: '상태', editable: true },
    ],
  },
  serialLog: {
    label: '시리얼 입출고 내역',
    columns: [
      { key: 'No', editable: false },
      { key: '항목', editable: true },
      { key: '시리얼 넘버', editable: true },
      { key: '출고일', editable: true },
      { key: '출고자', editable: true },
      { key: '직함', editable: true },
      { key: '소속', editable: true },
      { key: '연락처', editable: true },
      { key: '이메일', editable: true },
      { key: '반출일', editable: true },
      { key: '반납예정일', editable: true },
      { key: '반납일', editable: true },
      { key: '비고', editable: true },
      { key: '출고서명', editable: false },
      { key: '반납서명', editable: false },
      { key: '사진', editable: false },
    ],
  },
  consumableMaster: {
    label: '일반 물품 관리',
    columns: [
      { key: 'No', editable: false },
      { key: '항목', editable: true },
      { key: '초기 재고수량', editable: true, type: 'number' },
      { key: '출고 총갯수', editable: true, type: 'number' },
      { key: '현재 잔여갯수', editable: false, computed: true },
      { key: '비고', editable: true },
    ],
  },
  consumableLog: {
    label: '일반 입출고 내역',
    columns: [
      { key: 'No', editable: false },
      { key: '항목', editable: true },
      { key: '출고갯수', editable: true, type: 'number' },
      { key: '출고일', editable: true },
      { key: '출고자', editable: true },
      { key: '직책', editable: true },
      { key: '소속', editable: true },
      { key: '연락처', editable: true },
      { key: '이메일', editable: true },
      { key: '서명', editable: false },
    ],
  },
};

SHEET_TAB_CONFIG.inventoryMaster = {
  label: '물품관리',
  columns: [
    { key: 'No', editable: false },
    { key: '품목명', editable: true },
    { key: '시리얼 넘버', editable: true },
    { key: '현재 상태', editable: true },
    { key: '재고 수량', editable: true, type: 'number' },
    { key: '최소 재고 수량', editable: true, type: 'number' },
    { key: '규격/상세', editable: true },
    { key: '비고', editable: true },
  ],
};

export const ALL_TAB_CONFIG = { ...SHEET_TAB_CONFIG };
