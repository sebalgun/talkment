import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import * as replitDb from './replitDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../../data/app-config.json');

function ensureDir() {
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
}

function readRaw() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeRaw(data) {
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  replitDb.set('app_config', data); // fire and forget
}

/** Cloud Run 콜드스타트 시 Replit DB에서 파일 복원 */
export async function restoreFromDb() {
  if (existsSync(CONFIG_PATH)) return;
  const data = await replitDb.get('app_config');
  if (data) {
    ensureDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[AppConfig] Replit DB에서 설정 복원됨');
  }
}

function sheetFromEnv() {
  const id = config.google.spreadsheetId;
  if (!id) return null;
  return {
    spreadsheetId: id,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    title: '서버 기본 시트',
    alias: process.env.GOOGLE_SPREADSHEET_ALIAS || '사내 자산',
  };
}

/** PC·휴대폰 공유용 앱 설정 (시트 등록, Drive 폴더 등) */
export function getAppConfig() {
  const saved = readRaw();
  const sheet = saved.sheet?.spreadsheetId ? saved.sheet : sheetFromEnv();
  return {
    sheet: sheet || null,
    driveFolderId: saved.driveFolderId || config.google.driveSignatureFolderId || null,
  };
}

export function saveAppConfig({ sheet, driveFolderId }) {
  const current = readRaw();

  if (sheet === null) {
    delete current.sheet;
  } else if (sheet?.spreadsheetId) {
    current.sheet = {
      spreadsheetId: sheet.spreadsheetId,
      url: sheet.url || `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
      title: sheet.title || '제목 없음',
      alias: sheet.alias || sheet.title || '사내 자산',
    };
  }

  if (driveFolderId === null || driveFolderId === '') {
    delete current.driveFolderId;
  } else if (driveFolderId) {
    current.driveFolderId = driveFolderId;
  }

  writeRaw(current);
  return getAppConfig();
}

export function clearAppSheet() {
  const current = readRaw();
  delete current.sheet;
  writeRaw(current);
}
