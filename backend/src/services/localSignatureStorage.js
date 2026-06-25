import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SIGNATURES_DIR = path.resolve(__dirname, '../../data/signatures');

/** Base64 data URL → 로컬 파일 저장 */
export function saveSignature(base64Data, filename) {
  mkdirSync(SIGNATURES_DIR, { recursive: true });
  const buffer = Buffer.from(
    base64Data.replace(/^data:[^;]+;base64,/, ''),
    'base64'
  );
  writeFileSync(path.join(SIGNATURES_DIR, filename), buffer);
}
