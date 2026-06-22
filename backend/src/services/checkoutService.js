import {
  fetchSheetRows,
  appendRow,
  updateRow,
  getNextNo,
  updateCellByHeader,
} from './googleSheets.js';
import { getSheetNames } from './tabConfigService.js';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { masterStore } from './masterDataStore.js';

const today = () => new Date().toISOString().slice(0, 10);

async function nextRowIndex(sheetName) {
  const rows = await fetchSheetRows(sheetName);
  return rows.length + 2;
}

function employeeEmail(employee) {
  return employee['이메일주소'] || employee['이메일 주소'] || employee['이메일'] || '';
}

function consumableTotalOut(row) {
  return parseInt(row['출고 총갯수'] || row['츌고 총갯수'], 10) || 0;
}

function isSerialCheckedOut(status) {
  const s = String(status || '').trim();
  return s === '반출' || s === '대여중';
}

/** 시리얼 자산 출고 — 마스터 상태 갱신 + 입출고 이력 추가 */
export async function checkoutSerialAsset(data) {
  const SHEET_NAMES = getSheetNames();
  const masterRows = await fetchSheetRows(SHEET_NAMES.SERIAL_ASSETS);
  const master = masterRows.find(
    (r) => r['시리얼 넘버'] === data.serialNumber && r['항목'] === data.itemName
  );
  if (!master) {
    throw new Error(`시리얼 '${data.serialNumber}' (${data.itemName})을 물품 리스트에서 찾을 수 없습니다.`);
  }
  if (isSerialCheckedOut(master['상태'])) {
    throw new Error(`시리얼 '${data.serialNumber}'는 이미 반출 상태입니다.`);
  }

  await updateRow(SHEET_NAMES.SERIAL_ASSETS, master._rowIndex, [
    master['No'],
    master['항목'],
    master['시리얼 넘버'],
    '반출',
  ]);

  const no = await getNextNo(SHEET_NAMES.SERIAL_LOG);
  const rowIndex = await nextRowIndex(SHEET_NAMES.SERIAL_LOG);
  const checkoutDate = today();
  const row = [
    no,
    data.itemName,
    data.serialNumber,
    checkoutDate,
    data.employeeName,
    data.title,
    data.department,
    data.phone,
    data.email,
    checkoutDate,            // 반출일
    data.returnDueDate || '', // 반납예정일 ← 알림 스케줄러가 이 값을 기준으로 발송
    '',                      // 반납일
    '',                      // 비고
    '',                      // 출고서명
    '',                      // 반납서명
    '',                      // 사진
  ];
  await appendRow(SHEET_NAMES.SERIAL_LOG, row);

  // 물품 상태가 변경됐으므로 캐시 무효화
  masterStore.invalidate(getSpreadsheetId());

  return { sheet: SHEET_NAMES.SERIAL_LOG, no, rowIndex };
}

/** 소모품 출고 */
export async function checkoutConsumable(data) {
  const SHEET_NAMES = getSheetNames();
  const masterRows = await fetchSheetRows(SHEET_NAMES.CONSUMABLE_MASTER);
  const master = masterRows.find((r) => r['항목'] === data.itemName);
  if (!master) throw new Error(`소모품 '${data.itemName}'을(를) 찾을 수 없습니다.`);

  const remaining = parseInt(master['현재 잔여갯수'], 10);
  if (remaining < data.quantity) {
    throw new Error(`재고 부족: 잔여 ${remaining}개, 요청 ${data.quantity}개`);
  }

  const no = await getNextNo(SHEET_NAMES.CONSUMABLE_LOG);
  const rowIndex = await nextRowIndex(SHEET_NAMES.CONSUMABLE_LOG);
  const logRow = [
    no,
    data.itemName,
    data.quantity,
    today(),
    data.employeeName,
    data.title,
    data.department,
    data.phone,
    data.email,
    '',
  ];
  await appendRow(SHEET_NAMES.CONSUMABLE_LOG, logRow);

  masterStore.invalidate(getSpreadsheetId());

  const totalOut = consumableTotalOut(master) + data.quantity;
  const initial = parseInt(master['초기 재고수량'], 10);
  await updateRow(SHEET_NAMES.CONSUMABLE_MASTER, master._rowIndex, [
    master['No'],
    master['항목'],
    initial,
    totalOut,
    initial - totalOut,
    master['비고'] || '',
  ]);

  return { sheet: SHEET_NAMES.CONSUMABLE_LOG, no, rowIndex };
}

export async function processCheckout(parsed, employee) {
  const data = {
    itemName: parsed.itemName,
    serialNumber: parsed.serialNumber,
    quantity: parsed.quantity || 1,
    department: employee['소속'],
    employeeName: employee['이름'],
    title: employee['직함'] || '',
    phone: employee['연락처'],
    email: employeeEmail(employee),
    returnDueDate: parsed.returnDueDate,
  };

  if (parsed.itemType === 'consumable') {
    return checkoutConsumable(data);
  }

  const serialNumbers = Array.isArray(parsed.serialNumbers) && parsed.serialNumbers.length
    ? parsed.serialNumbers
    : parsed.serialNumber
      ? [parsed.serialNumber]
      : [];

  const quantity = parsed.quantity || serialNumbers.length || 1;
  if (serialNumbers.length !== quantity) {
    throw new Error(`시리얼 번호 ${quantity}개를 선택해야 합니다. (현재 ${serialNumbers.length}개)`);
  }

  const results = [];
  for (const serialNumber of serialNumbers) {
    results.push(await checkoutSerialAsset({ ...data, serialNumber }));
  }

  return {
    sheet: results[0].sheet,
    rowIndex: results[0].rowIndex,
    rowIndexes: results.map((r) => r.rowIndex),
    results,
  };
}

/** 시리얼 반납 — 이력 반납일 + 마스터 상태 복구 */
export async function processSerialReturn(item) {
  const SHEET_NAMES = getSheetNames();
  const returnDate = today();
  await updateCellByHeader(SHEET_NAMES.SERIAL_LOG, item._rowIndex, '반납일', returnDate);

  const masterRows = await fetchSheetRows(SHEET_NAMES.SERIAL_ASSETS);
  const master = masterRows.find(
    (r) => r['시리얼 넘버'] === item['시리얼 넘버'] && r['항목'] === item['항목']
  );
  if (master) {
    await updateRow(SHEET_NAMES.SERIAL_ASSETS, master._rowIndex, [
      master['No'],
      master['항목'],
      master['시리얼 넘버'],
      '',
    ]);
  }

  return { rowIndex: item._rowIndex, returnDate };
}
