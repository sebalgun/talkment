import { SHEET_TAB_CONFIG } from '../constants/sheetColumns.js';
import { SHEET_NAMES } from '../constants/sheetNames.js';
import { fetchSheetRows, updateRow } from './googleSheets.js';

const TAB_TO_SHEET = {
  employees: SHEET_NAMES.EMPLOYEES,
  assets: SHEET_NAMES.SERIAL_ASSETS,
  serialLog: SHEET_NAMES.SERIAL_LOG,
  consumableMaster: SHEET_NAMES.CONSUMABLE_MASTER,
  consumableLog: SHEET_NAMES.CONSUMABLE_LOG,
  inventoryMaster: '물품관리',
};

const HEADER_ALIASES = {
  '이메일 주소': '이메일주소',
  '출고 총갯수': '츌고 총갯수',
};

function resolveColumnKeys(tabConfig, row) {
  return tabConfig.columns.map((col) => {
    if (row[col.key] !== undefined) return col.key;
    const alias = HEADER_ALIASES[col.key];
    if (alias && row[alias] !== undefined) return alias;
    if (col.key === '이메일주소' && row['이메일 주소'] !== undefined) return '이메일 주소';
    if (col.key === '이메일' && row['이메일주소'] !== undefined) return '이메일주소';
    if (col.key === '출고 총갯수' && row['츌고 총갯수'] !== undefined) return '츌고 총갯수';
    return col.key;
  });
}

function buildRowValues(tabConfig, merged, row) {
  const keys = resolveColumnKeys(tabConfig, row);
  return tabConfig.columns.map((col, i) => merged[keys[i]] ?? '');
}

function consumableTotalOut(row) {
  return parseInt(row['출고 총갯수'] || row['츌고 총갯수'], 10) || 0;
}

/** 시트 행 수기 수정 */
export async function updateSheetRow(tab, rowIndex, fields) {
  const tabConfig = SHEET_TAB_CONFIG[tab];
  const sheetName = TAB_TO_SHEET[tab];
  if (!tabConfig || !sheetName) {
    throw new Error('알 수 없는 탭입니다.');
  }
  if (!rowIndex || typeof fields !== 'object') {
    throw new Error('rowIndex와 fields가 필요합니다.');
  }

  const rows = await fetchSheetRows(sheetName);
  const row = rows.find((r) => r._rowIndex === rowIndex);
  if (!row) throw new Error('해당 행을 찾을 수 없습니다.');

  const merged = { ...row };
  const keys = resolveColumnKeys(tabConfig, row);

  tabConfig.columns.forEach((col, i) => {
    const dataKey = keys[i];
    if (!col.editable) return;
    if (fields[col.key] !== undefined) {
      merged[dataKey] = fields[col.key];
    }
  });

  if (tab === 'consumableMaster') {
    const initial = parseInt(merged['초기 재고수량'], 10) || 0;
    const totalOutKey = keys[tabConfig.columns.findIndex((c) => c.key === '출고 총갯수')];
    const totalOut = parseInt(merged[totalOutKey], 10) || 0;
    if (totalOut > initial) {
      throw new Error(`출고 총갯수(${totalOut})가 초기 재고(${initial})를 초과할 수 없습니다.`);
    }
    merged['현재 잔여갯수'] = String(initial - totalOut);
  }

  const values = buildRowValues(tabConfig, merged, row);
  await updateRow(sheetName, rowIndex, values);

  return { ok: true, rowIndex, sheet: sheetName };
}
