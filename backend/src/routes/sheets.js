import { Router } from 'express';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { config } from '../config/env.js';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { updateSheetRow } from '../services/rowEditService.js';
import { SHEET_NAMES } from '../constants/sheetNames.js';

const router = Router();

function getSheets() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : JSON.parse(readFileSync(config.google.serviceAccountPath, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** 등록된 시트 연결 및 필수 탭 검증 (X-Spreadsheet-Id 헤더 필요) */
router.get('/verify', async (req, res, next) => {
  try {
    const spreadsheetId = getSpreadsheetId();
    const meta = await getSheets().spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });

    const tabs = meta.data.sheets.map((s) => s.properties.title);
    const required = Object.values(SHEET_NAMES);
    const missing = required.filter((t) => !tabs.includes(t));

    res.json({
      ok: missing.length === 0,
      spreadsheetId,
      title: meta.data.properties.title,
      tabs,
      requiredTabs: required,
      missingTabs: missing,
    });
  } catch (err) {
    next(err);
  }
});

/** 시트 행 수기 수정 */
router.put('/rows', async (req, res, next) => {
  try {
    const { tab, rowIndex, fields } = req.body;
    const result = await updateSheetRow(tab, rowIndex, fields);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
