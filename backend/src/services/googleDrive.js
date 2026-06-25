import { google } from 'googleapis';
import { Readable } from 'stream';
import { readFileSync } from 'fs';
import { config } from '../config/env.js';

function getDrive() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    credentials = JSON.parse(readFileSync(config.google.serviceAccountPath, 'utf-8'));
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/** Base64 PNG → Google Drive 업로드 → 공개 조회 URL 반환 */
export async function uploadSignaturePng(base64Data, filename, folderId) {
  if (!folderId) {
    throw new Error(
      '서명 저장 폴더가 설정되지 않았습니다. 앱 설정에서 Drive 폴더를 연결해 주세요.'
    );
  }

  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const buffer = Buffer.from(
    base64Data.replace(/^data:[^;]+;base64,/, ''),
    'base64'
  );

  const drive = getDrive();
  let file;
  try {
    file = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        mimeType,
      },
      media: {
        mimeType: 'image/png',
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    });
  } catch (err) {
    console.error('[Drive Upload Error]', err.message, err.code, JSON.stringify(err.errors || ''));
    const msg = err.message || '';
    if (msg.includes('storageQuotaExceeded') || msg.includes('storage quota')) {
      throw new Error(
        '서비스 계정은 일반 Drive 폴더에 파일을 저장할 수 없습니다(저장 용량 0). ' +
        'Google Workspace 공유 드라이브(Shared Drive)에 폴더를 만들고 서비스 계정을 편집자로 추가한 뒤 폴더 ID를 등록해 주세요.'
      );
    }
    if (msg.includes('File not found') || err.code === 404) {
      throw new Error(
        '서명 저장 폴더를 찾을 수 없습니다. GOOGLE_DRIVE_SIGNATURE_FOLDER_ID와 폴더 공유 권한을 확인해 주세요.'
      );
    }
    throw err;
  }

  const fileId = file.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  return { fileId, directUrl };
}

/** 시트 셀에 =IMAGE() 수식 삽입 */
export function imageFormula(directUrl) {
  return `=IMAGE("${directUrl}")`;
}
