import { Router } from 'express';
import { getAppConfig, saveAppConfig, clearAppSheet } from '../services/appConfigStore.js';

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

export default router;
