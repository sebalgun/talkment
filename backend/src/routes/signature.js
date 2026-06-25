import { Router } from 'express';
import { uploadSignaturePng, imageFormula } from '../services/googleDrive.js';
import { saveSignature } from '../services/localSignatureStorage.js';
import { updateCellByHeader, setRowHeight } from '../services/googleSheets.js';
import { config } from '../config/env.js';

const router = Router();

const COLUMN_HEADERS = {
  checkout: '출고서명',
  return: '반납서명',
  consumableCheckout: '서명',
};

async function saveSignatureToSheet({ sheet, rowIndex, column, base64, folderId, baseUrl }) {
  const headerName = COLUMN_HEADERS[column];
  if (!headerName) throw new Error(`알 수 없는 서명 컬럼: ${column}`);

  const filename = `sig_${Date.now()}_${column}.jpg`;
  let value = '서명완료';
  let mode = 'text-only';

  // 1) Drive 설정된 경우 먼저 시도
  if (folderId) {
    try {
      const { directUrl } = await uploadSignaturePng(base64, filename, folderId);
      value = imageFormula(directUrl);
      mode = 'image';
    } catch (driveErr) {
      console.warn('[Signature] Drive 업로드 실패, 로컬 저장으로 전환:', driveErr.message);
    }
  }

  // 2) Drive 미설정 또는 실패 시 → 서버 로컬 저장
  if (mode !== 'image') {
    try {
      saveSignature(base64, filename);
      value = imageFormula(`${baseUrl}/signatures/${filename}`);
      mode = 'image';
    } catch (localErr) {
      console.warn('[Signature] 로컬 저장 실패, 텍스트로 저장:', localErr.message);
    }
  }

  await updateCellByHeader(sheet, rowIndex, headerName, value);
  await setRowHeight(sheet, rowIndex, mode === 'image' ? 70 : 40);

  return { success: true, mode, header: headerName };
}

router.post('/', async (req, res, next) => {
  try {
    const { sheet, rowIndex, column, base64 } = req.body;
    if (!sheet || !rowIndex || !column || !base64) {
      return res.status(400).json({ error: 'sheet, rowIndex, column, base64 필드가 필요합니다.' });
    }

    const folderId = req.headers['x-drive-folder-id'] || config.google.driveSignatureFolderId || null;

    // 공개 URL 결정: PUBLIC_URL 환경변수 우선, 없으면 요청 host에서 추출
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = process.env.PUBLIC_URL || `${proto}://${host}`;

    const result = await saveSignatureToSheet({ sheet, rowIndex, column, base64, folderId, baseUrl });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
