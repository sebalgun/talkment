import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAppConfig, saveAppConfig, clearAppSheet } from '../services/appConfigStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_CONFIG_PATH = path.resolve(__dirname, '../../data/app-config.json');
const WORKSPACES_PATH = path.resolve(__dirname, '../../data/workspaces.json');

const router = Router();

/** 앱 설정 조회 — PC·휴대폰(zrok) 공유 */
router.get('/', (_req, res) => {
  res.json(getAppConfig());
});

/** 앱 설정 저장 */
router.put('/', (req, res) => {
  try {
    const { sheet, driveFolderId } = req.body || {};
    if (sheet === null) {
      clearAppSheet();
      const cfg = getAppConfig();
      if (driveFolderId !== undefined) {
        return res.json(saveAppConfig({ driveFolderId }));
      }
      return res.json(cfg);
    }
    const saved = saveAppConfig({ sheet, driveFolderId });
    console.log('[AppConfig] 저장됨:', saved.sheet?.spreadsheetId || '(시트 없음)');
    res.json(saved);
  } catch (err) {
    console.error('[AppConfig] 저장 실패:', err);
    res.status(500).json({ error: err.message || '설정 저장 실패' });
  }
});

/** 설정 내보내기 — 재배포 후에도 설정 유지를 위한 환경변수 값 반환 */
router.get('/export', (_req, res) => {
  try {
    const toB64 = (filePath) => {
      if (!existsSync(filePath)) return null;
      const raw = readFileSync(filePath, 'utf-8');
      return Buffer.from(raw).toString('base64');
    };
    res.json({
      TALKMENT_APP_CONFIG: toB64(APP_CONFIG_PATH),
      TALKMENT_WORKSPACES: toB64(WORKSPACES_PATH),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
