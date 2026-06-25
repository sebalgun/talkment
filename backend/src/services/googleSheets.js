import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { config, SHEET_NAMES } from '../config/env.js';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';

let authClient = null;

function getAuth() {
  if (authClient) return authClient;

  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    const keyFile = config.google.serviceAccountPath;
    if (!keyFile) throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH가 설정되지 않았습니다.');
    credentials = JSON.parse(readFileSync(keyFile, 'utf-8'));
  }

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return authClient;
}

/** authService에서 Drive API 호출 시 사용 */
export function getGoogleAuth() {
  return getAuth();
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

/** 캐시 없이 항상 최신 시트 데이터를 페치 — 탭이 없으면 빈 배열 반환 */
export async function fetchSheetRows(sheetName) {
  let res;
  try {
    res = await getSheets().spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${sheetName}'!A:AZ`,
    });
  } catch (err) {
    // 탭이 존재하지 않을 때 Google Sheets API는 400 + "Unable to parse range" 반환
    const msg = err.message || '';
    if (err.code === 400 || msg.includes('Unable to parse range') || msg.includes('badRequest')) {
      console.warn(`[Sheets] 탭 없음 또는 읽기 실패 — '${sheetName}': ${msg}`);
      return [];
    }
    throw err;
  }
  const rows = res.data.values || [];
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row, idx) => {
    const obj = { _rowIndex: idx + 2 };
    headers.forEach((h, i) => {
      obj[h.trim()] = row[i] ?? '';
    });
    return obj;
  });
}

export async function appendRow(sheetName, values) {
  await getSheets().spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `'${sheetName}'!A:AZ`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

export async function updateRow(sheetName, rowIndex, values) {
  const endCol = String.fromCharCode(64 + values.length);
  await getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${sheetName}'!A${rowIndex}:${endCol}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

export async function updateCell(sheetName, cell, value) {
  await getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${sheetName}'!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

function columnLetter(index) {
  let n = index;
  let s = '';
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** 헤더명으로 셀 위치를 찾아 업데이트 */
export async function updateCellByHeader(sheetName, rowIndex, headerName, value) {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `'${sheetName}'!1:1`,
  });
  const headers = res.data.values?.[0] || [];
  const colIndex = headers.findIndex((h) => String(h).trim() === headerName);
  if (colIndex < 0) {
    throw new Error(`시트에 '${headerName}' 컬럼이 없습니다.`);
  }
  await updateCell(sheetName, `${columnLetter(colIndex + 1)}${rowIndex}`, value);
}

export async function setRowHeight(sheetName, rowIndex, pixelSize = 70) {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
  });
  const sheet = meta.data.sheets.find(
    (s) => s.properties.title === sheetName
  );
  if (!sheet) return;

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [
        {
          updateDimensionProperties: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
            properties: { pixelSize },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });
}

export async function getNextNo(sheetName) {
  const rows = await fetchSheetRows(sheetName);
  if (rows.length === 0) return 1;
  const nums = rows.map((r) => parseInt(r['No'], 10)).filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/**
 * AsyncLocalStorage 없이 spreadsheetId를 직접 지정하여 시트 데이터 조회
 * masterDataStore, 크론 작업 등 요청 컨텍스트 밖에서 사용한다.
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName
 */
export async function fetchSheetRowsById(spreadsheetId, sheetName) {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:AZ`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row, idx) => {
    const obj = { _rowIndex: idx + 2 };
    headers.forEach((h, i) => {
      obj[h.trim()] = row[i] ?? '';
    });
    return obj;
  });
}

/**
 * 스프레드시트의 모든 시트(탭) 이름 목록 반환
 * 온보딩 탭 선택 UI에서 사용
 */
export async function getSheetTabNames(spreadsheetId) {
  const res = await getSheets().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (res.data.sheets || []).map((s) => s.properties.title);
}

/**
 * 특정 탭의 첫 번째 행(헤더) 반환
 * 온보딩 컬럼 매핑 UI에서 사용
 */
export async function getSheetHeaders(spreadsheetId, tabName) {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!1:1`,
  });
  const row = res.data.values?.[0] ?? [];
  return row.map((h) => String(h).trim()).filter(Boolean);
}

export { SHEET_NAMES };
