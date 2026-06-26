/**
 * 통합 재고 서비스
 *
 * 우선순위:
 *   1) 워크스페이스에 탭 설정이 있으면 해당 탭 직접 사용 (_source: 'legacy')
 *   2) 탭 설정 없고 [물품관리] 탭에 데이터가 있으면 사용 (_source: 'inventoryMaster')
 *   3) 레거시 하드코딩 탭명 폴백 (_source: 'legacy')
 *
 * 반환 아이템 공통 추가 필드:
 *   _type        : 'serial' | 'consumable'
 *   _itemName    : string
 *   _serialNumber: string | null
 *   _status      : 'available' | 'checkedOut' | null   (serial only)
 *   _quantity    : number                               (consumable)
 *   _minQuantity : number | null
 *   _isLowStock  : boolean
 *   _spec        : string
 *   _source      : 'inventoryMaster' | 'legacy'
 */

import { fetchSheetRows } from './googleSheets.js';
import { getTabConfig, getSheetNames } from './tabConfigService.js';

const trim = (v) => String(v ?? '').trim();

// || 체인의 falsy-zero 함정 방지: 빈 문자열/null/undefined만 건너뜀
function pickCol(row, ...keys) {
  for (const k of keys) {
    const v = String(row[k] ?? '').trim();
    if (v !== '') return v;
  }
  return '';
}

function normalizeStatus(raw) {
  const s = trim(raw);
  if (s === '반출완료' || s === '반출' || s === '대여중') return 'checkedOut';
  return 'available';
}

function parseRow(row, source = 'legacy') {
  const itemName = trim(row['품목명'] || row['항목']);
  if (!itemName) return null;

  const serialNumber = trim(pickCol(row, '시리얼 넘버', '시리얼넘버'));

  if (serialNumber) {
    const rawStatus = pickCol(row, '현재 상태', '상태');
    return {
      ...row,
      _type: 'serial',
      _itemName: itemName,
      _serialNumber: serialNumber,
      _status: normalizeStatus(rawStatus),
      _quantity: 1,
      _minQuantity: null,
      _isLowStock: false,
      _spec: trim(pickCol(row, '규격/상세', '규격')),
      _source: source,
    };
  }

  // 소모품 — falsy-zero 방지: '0'도 정상 처리
  const qtyStr = pickCol(row, '재고 수량', '현재 잔여갯수', '수량');
  const minStr = pickCol(row, '최소 재고 수량', '최소재고', '최소수량');
  const quantity = isNaN(parseInt(qtyStr, 10)) ? 0 : parseInt(qtyStr, 10);
  const minQty = parseInt(minStr, 10);
  const minQuantity = isNaN(minQty) ? null : minQty;

  return {
    ...row,
    _type: 'consumable',
    _itemName: itemName,
    _serialNumber: null,
    _status: null,
    _quantity: quantity,
    _minQuantity: minQuantity,
    _isLowStock: minQuantity !== null && quantity < minQuantity,
    _spec: trim(pickCol(row, '규격/상세', '규격')),
    _source: source,
  };
}

export async function getInventory() {
  const cfg = getTabConfig();

  // 워크스페이스 탭 설정 있으면 직접 사용 — 불필요한 API 호출 없음
  if (cfg.hasTab('serialAssets') || cfg.hasTab('consumableMaster')) {
    const NAMES = getSheetNames();
    const [serialRows, consumableRows] = await Promise.all([
      cfg.hasTab('serialAssets') ? fetchSheetRows(NAMES.SERIAL_ASSETS) : Promise.resolve([]),
      cfg.hasTab('consumableMaster') ? fetchSheetRows(NAMES.CONSUMABLE_MASTER) : Promise.resolve([]),
    ]);
    return [...serialRows, ...consumableRows].map((r) => parseRow(r, 'legacy')).filter(Boolean);
  }

  // 통합 [물품관리] 탭 시도
  const masterRows = await fetchSheetRows('물품관리');
  if (masterRows.length > 0) {
    return masterRows.map((r) => parseRow(r, 'inventoryMaster')).filter(Boolean);
  }

  // 레거시 폴백
  const NAMES = getSheetNames();
  const [serialRows, consumableRows] = await Promise.all([
    fetchSheetRows(NAMES.SERIAL_ASSETS),
    fetchSheetRows(NAMES.CONSUMABLE_MASTER),
  ]);
  return [...serialRows, ...consumableRows].map((r) => parseRow(r, 'legacy')).filter(Boolean);
}
