/**
 * 필드 매퍼
 *
 * 사용자 시트의 실제 컬럼명 ↔ 내부 필드 키 변환을 담당.
 *
 * 내부 필드 키(예: 'name', 'itemName')를 실제 시트 컬럼명(예: '이름', '품목')으로
 * 매핑하여 파서가 컬럼명에 관계없이 동작하도록 한다.
 *
 * 핵심 전략:
 *   - 읽기: remapRows()로 실제 컬럼명 → 표준 컬럼명으로 row를 변환 후 기존 파서에 전달
 *   - 쓰기: buildWriteRow()로 내부 데이터 → 실제 시트 컬럼 순서 배열로 변환
 */

// ─── 탭 목적별 내부 필드 키 → 표준 한국어 컬럼명 기본값 ──────

export const DEFAULT_FIELDS = {
  employees: {
    no: 'No',
    name: '이름',
    title: '직함',
    department: '소속',
    phone: '연락처',
    email: '이메일주소',
  },
  serialAssets: {
    no: 'No',
    itemName: '항목',
    serialNumber: '시리얼 넘버',
    status: '상태',
  },
  serialLog: {
    no: 'No',
    itemName: '항목',
    serialNumber: '시리얼 넘버',
    checkoutDate: '출고일',
    employeeName: '출고자',
    title: '직함',
    department: '소속',
    phone: '연락처',
    email: '이메일',
    checkoutDateCol: '반출일',
    returnDueDate: '반납예정일',
    returnDate: '반납일',
    note: '비고',
    checkoutSign: '출고서명',
    returnSign: '반납서명',
    photo: '사진',
  },
  consumableMaster: {
    no: 'No',
    itemName: '항목',
    initialStock: '초기 재고수량',
    totalOut: '출고 총갯수',
    remaining: '현재 잔여갯수',
    note: '비고',
  },
  consumableLog: {
    no: 'No',
    itemName: '항목',
    quantity: '출고갯수',
    checkoutDate: '출고일',
    employeeName: '출고자',
    title: '직책',
    department: '소속',
    phone: '연락처',
    email: '이메일',
    sign: '서명',
  },
};

// ─── 탭 목적별 필수/선택 필드 스키마 (온보딩 UI에서 사용) ─────

export const FIELD_SCHEMA = {
  employees: [
    { key: 'name',       label: '이름',     required: true },
    { key: 'email',      label: '이메일',   required: false, hint: '반납 알림 발송에 필요' },
    { key: 'title',      label: '직함',     required: false },
    { key: 'department', label: '소속/부서', required: false },
    { key: 'phone',      label: '연락처',   required: false },
  ],
  serialAssets: [
    { key: 'itemName',     label: '품목명',    required: true },
    { key: 'serialNumber', label: '시리얼번호', required: true },
    { key: 'status',       label: '상태',      required: false, hint: '시스템이 자동 관리' },
  ],
  serialLog: [
    { key: 'itemName',     label: '품목명',    required: true },
    { key: 'serialNumber', label: '시리얼번호', required: true },
    { key: 'employeeName', label: '출고자',    required: true },
    { key: 'returnDueDate',label: '반납예정일', required: false, hint: '알림 발송에 필요' },
    { key: 'returnDate',   label: '반납일',    required: false, hint: '시스템이 자동 기록' },
    { key: 'email',        label: '이메일',    required: false },
    { key: 'department',   label: '소속',      required: false },
  ],
  consumableMaster: [
    { key: 'itemName',    label: '품목명',   required: true },
    { key: 'initialStock',label: '초기수량', required: true },
    { key: 'totalOut',    label: '출고수량', required: false, hint: '시스템이 자동 관리' },
    { key: 'remaining',   label: '잔여수량', required: false, hint: '시스템이 자동 관리' },
  ],
  consumableLog: [
    { key: 'itemName',    label: '품목명',   required: true },
    { key: 'quantity',    label: '출고수량', required: true },
    { key: 'employeeName',label: '출고자',   required: true },
    { key: 'email',       label: '이메일',   required: false },
    { key: 'department',  label: '소속',     required: false },
  ],
};

// ─── 읽기 변환 ────────────────────────────────────────────────

/**
 * raw row 배열을 표준 컬럼명으로 리매핑하여 반환.
 * 기존 파서(sheetParser.js)가 표준 컬럼명으로 동작하므로, 파서 수정 없이 재사용 가능.
 *
 * @param {object[]} rows   - fetchSheetRows() 결과 (실제 컬럼명 키)
 * @param {string}   purpose - 'employees' | 'serialAssets' | 'serialLog' | ...
 * @param {object}   fieldsConfig - workspace tabs[purpose].fields (없으면 기본값 사용)
 */
export function remapRows(rows, purpose, fieldsConfig = {}) {
  const defaults = DEFAULT_FIELDS[purpose];
  if (!defaults) return rows;

  return rows.map((row) => {
    const out = { _rowIndex: row._rowIndex };
    for (const [fieldKey, standardCol] of Object.entries(defaults)) {
      const actualCol = fieldsConfig[fieldKey] || standardCol;
      out[standardCol] = row[actualCol] ?? '';
    }
    // 매핑에 없는 원본 키도 보존 (안전망)
    for (const [k, v] of Object.entries(row)) {
      if (!(k in out)) out[k] = v;
    }
    return out;
  });
}

// ─── 쓰기 변환 ────────────────────────────────────────────────

/**
 * 내부 데이터 객체를 실제 시트 컬럼 순서의 배열로 변환.
 * appendRow() 호출 시 사용.
 *
 * @param {object}   data        - { name, email, ... } 내부 필드 키 기준
 * @param {string}   purpose
 * @param {string[]} fieldOrder  - 써야 할 내부 필드 키 순서
 * @param {object}   fieldsConfig
 */
export function buildWriteRow(data, purpose, fieldOrder, fieldsConfig = {}) {
  const defaults = DEFAULT_FIELDS[purpose] || {};
  return fieldOrder.map((fieldKey) => {
    // data는 내부 필드 키 OR 표준 컬럼명 둘 다 허용
    return data[fieldKey] ?? data[defaults[fieldKey]] ?? '';
  });
}

// ─── 단일 필드 조회 ───────────────────────────────────────────

/**
 * 특정 목적의 내부 필드 키에 해당하는 실제 컬럼명 반환.
 */
export function resolveColName(purpose, fieldKey, fieldsConfig = {}) {
  return fieldsConfig[fieldKey] || DEFAULT_FIELDS[purpose]?.[fieldKey] || fieldKey;
}
