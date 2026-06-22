/**
 * 시트 데이터 파서 — 순수 변환 함수 모음
 *
 * Google Sheets raw rows를 앱에서 사용하기 좋은 형태로 변환한다.
 *
 * 설계 원칙:
 *  - I/O 없음 (순수 함수 — 테스트 용이)
 *  - 원본 한국어 키 보존 (기존 코드 하위 호환)
 *  - 계산·정규화 필드는 _ 접두어로 추가
 *  - 빈 행(핵심 컬럼 없음) 필터링
 *  - 숫자 컬럼은 항상 number 타입 변환
 */

// ─── 공통 유틸 ───────────────────────────────────────────────

const trim = (v) => String(v ?? '').trim();
const hasValue = (row, key) => trim(row[key]).length > 0;

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 이메일 컬럼 다중 이름 허용 ('이메일주소' / '이메일 주소' / '이메일') */
function extractEmail(row) {
  return trim(row['이메일주소'] || row['이메일 주소'] || row['이메일']);
}

/** 시리얼 자산 상태 정규화 */
function normalizeAssetStatus(raw) {
  const s = trim(raw);
  return s === '반출' || s === '대여중' ? 'checkedOut' : 'available';
}

// ─── 시트별 파서 ─────────────────────────────────────────────

/**
 * [직원 명단] 시트 파싱
 *
 * 추가 필드:
 *   _no          : number   — No 컬럼을 숫자로 변환
 *   _email       : string   — 이메일 필드명 다양성 통합
 *   _displayName : string   — "이름 (직함)" 형태 (UI 표시용)
 */
export function parseEmployees(rawRows) {
  return rawRows
    .filter((row) => hasValue(row, '이름'))
    .map((row) => ({
      ...row,
      _no: toInt(row['No']),
      _email: extractEmail(row),
      _displayName: row['이름'] + (row['직함'] ? ` (${row['직함']})` : ''),
    }));
}

/**
 * [시리얼 물품 관리] 시트 파싱
 *
 * 추가 필드:
 *   _no          : number
 *   _status      : 'available' | 'checkedOut'
 *   _isAvailable : boolean
 */
export function parseSerialAssets(rawRows) {
  return rawRows
    .filter((row) => hasValue(row, '항목'))
    .map((row) => {
      const status = normalizeAssetStatus(row['상태']);
      return {
        ...row,
        _no: toInt(row['No']),
        _status: status,
        _isAvailable: status === 'available',
      };
    });
}

/**
 * [일반 물품 관리] 소모품 마스터 파싱
 *
 * 추가 필드:
 *   _no           : number
 *   _initialStock : number
 *   _totalOut     : number  — '츌고 총갯수' 오타까지 허용
 *   _remaining    : number  — 음수 방지 처리
 *   _hasStock     : boolean
 */
export function parseConsumableAssets(rawRows) {
  return rawRows
    .filter((row) => hasValue(row, '항목'))
    .map((row) => {
      const initial = toInt(row['초기 재고수량']);
      const totalOut = toInt(row['출고 총갯수'] || row['츌고 총갯수']);
      const remaining = Math.max(0, initial - totalOut);
      return {
        ...row,
        _no: toInt(row['No']),
        _initialStock: initial,
        _totalOut: totalOut,
        _remaining: remaining,
        _hasStock: remaining > 0,
      };
    });
}

/**
 * [시리얼 입출고 내역] 파싱
 *
 * 추가 필드:
 *   _no         : number
 *   _isReturned : boolean
 */
export function parseSerialLog(rawRows) {
  return rawRows
    .filter((row) => hasValue(row, '항목'))
    .map((row) => ({
      ...row,
      _no: toInt(row['No']),
      _isReturned: hasValue(row, '반납일'),
    }));
}

/**
 * [일반 입출고 내역] 파싱
 *
 * 추가 필드:
 *   _no       : number
 *   _quantity : number
 */
export function parseConsumableLog(rawRows) {
  return rawRows
    .filter((row) => hasValue(row, '항목'))
    .map((row) => ({
      ...row,
      _no: toInt(row['No']),
      _quantity: toInt(row['출고갯수']),
    }));
}

// ─── 요약 헬퍼 ───────────────────────────────────────────────

/**
 * 시리얼 자산 현황 요약
 * @param {ReturnType<typeof parseSerialAssets>} parsed
 * @returns {{ total: number, available: number, checkedOut: number }}
 */
export function summarizeSerialAssets(parsed) {
  const checkedOut = parsed.filter((r) => !r._isAvailable).length;
  return { total: parsed.length, available: parsed.length - checkedOut, checkedOut };
}

/**
 * 소모품 현황 요약 (품목별 잔여 수량)
 * @param {ReturnType<typeof parseConsumableAssets>} parsed
 * @returns {Array<{ itemName: string, remaining: number, hasStock: boolean }>}
 */
export function summarizeConsumables(parsed) {
  return parsed.map((r) => ({
    itemName: r['항목'],
    remaining: r._remaining,
    hasStock: r._hasStock,
  }));
}

/**
 * 직원명으로 검색 (정확 일치, 동명이인 포함 반환)
 * @param {ReturnType<typeof parseEmployees>} employees
 * @param {string} name
 */
export function findEmployeesByName(employees, name) {
  const q = trim(name);
  if (!q) return [];
  return employees.filter((e) => trim(e['이름']) === q);
}
