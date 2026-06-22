import { Router } from 'express';
import { uploadSignaturePng, imageFormula } from '../services/googleDrive.js';
import { updateCell, updateCellByHeader, setRowHeight } from '../services/googleSheets.js';
import { config } from '../config/env.js';

const router = Router();

const COLUMN_HEADERS = {
  checkout: '출고서명',
  return: '반납서명',
  consumableCheckout: '서명',
};

async function saveSignatureToSheet({ sheet, rowIndex, column, base64, folderId }) {
  const headerName = COLUMN_HEADERS[column];
  if (!headerName) {
    throw new Error(`알 수 없는 서명 컬럼: ${column}`);
  }

  const value = !folderId
    ? '서명완료'
    : imageFormula((await uploadSignaturePng(
        base64,
        `sig_${sheet}_${rowIndex}_${column}_${Date.now()}.png`,
        folderId
      )).directUrl);

  await updateCellByHeader(sheet, rowIndex, headerName, value);
  await setRowHeight(sheet, rowIndex, folderId ? 70 : 40);

  return {
    success: true,
    mode: folderId ? 'image' : 'text-only',
    header: headerName,
  };
}

/**
 * 서명 PNG 업로드 + 시트 셀 삽입
 * body: { sheet, rowIndex, column ('checkout' | 'return'), base64 }
 */
router.post('/', async (req, res, next) => {
  try {
    const { sheet, rowIndex, column, base64 } = req.body;
    if (!sheet || !rowIndex || !column || !base64) {
      return res.status(400).json({ error: 'sheet, rowIndex, column, base64 필드가 필요합니다.' });
    }

    const folderId =
      req.headers['x-drive-folder-id'] || config.google.driveSignatureFolderId || null;

    const result = await saveSignatureToSheet({
      sheet,
      rowIndex,
      column,
      base64,
      folderId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
