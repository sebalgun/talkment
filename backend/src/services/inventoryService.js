/**
 * 통합 재고 서비스
 *
 * 새 구조 [물품관리] 탭 우선 읽기 → 없으면 구 탭([시리얼 물품 관리] + [일반 물품 관리]) 폴백
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
 */

import { fetchSheetRows } from './googleSheets.js';
import { getSheetNames } from './tabConfigService.js';

const trim = (v) => String(v ?? '').trim();

function normalizeStatus(raw) {
  const s = trim(raw);
  if (s === '반출완료' || s === '반출' || s === '대여중') return 'checkedOut';
  return 'available';
}

function parseRow(row) {
  const itemName = trim(row['품목명'] || row['항목']);
  if (!itemName) return null;

  const serialNumber = trim(row['시리얼 넘버'] || row['시리얼넘버'] || '');

  if (serialNumber) {
    const rawStatus = row['현재 상태'] || row['상태'] || '';
    return {
      ...row,
      _type: 'serial',
      _itemName: itemName,
      _serialNumber: serialNumber,
      _status: normalizeStatus(rawStatus),
      _quantity: 1,
      _minQuantity: null,
      _isLowStock: false,
      _spec: trim(row['규격/상세'] || row['규격'] || ''),
    };
  }

  // 소모품 — 신/구 컬럼명 모두 허용
  const qty = parseInt(
    row['재고 수량'] || row['현재 잔여갯수'] || row['수량'] || '0', 10
  );
  const minRaw = row['최소 재고 수량'] || row['최소재고'] || row['최소수량'] || '';
  const minQty = parseInt(minRaw, 10);
  const quantity = isNaN(qty) ? 0 : qty;
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
    _spec: trim(row['규격/상세'] || row['규격'] || ''),
  };
}

export async function getInventory() {
  // 새 구조 [물품관리] 우선
  let rawRows = await fetchSheetRows('물품관리');

  if (rawRows.length === 0) {
    // 구 구조 폴백
    const NAMES = getSheetNames();
    const [serialRows, consumableRows] = await Promise.all([
      fetchSheetRows(NAMES.SERIAL_ASSETS),
      fetchSheetRows(NAMES.CONSUMABLE_MASTER),
    ]);
    rawRows = [...serialRows, ...consumableRows];
  }

  return rawRows.map(parseRow).filter(Boolean);
}
