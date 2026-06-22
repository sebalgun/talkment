/**
 * Talkment 스프레드시트 샘플 파일 생성
 * 실행: node samples/generate-samples.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;

const INTERNAL_SHEETS = {
  명단: {
    headers: ['No', '이름', '직함', '소속', '연락처', '이메일주소'],
    rows: [
      ['1', '홍길동', '대리', 'IT', '010-1234-4567', 'kim@example.com'],
      ['2', '이영희', '과장', '영업팀', '010-3333-4444', 'lee@example.com'],
    ],
  },
  '시리얼 물품 관리': {
    headers: ['No', '항목', '시리얼 넘버', '상태'],
    rows: [
      ['1', 'PC', '100-1', ''],
      ['2', 'PC', '100-2', ''],
      ['3', 'MacBook Pro 14', 'C02XYZ123456', ''],
    ],
  },
  '시리얼 입출고 내역': {
    headers: [
      'No', '항목', '시리얼 넘버', '출고일', '출고자', '직함', '소속',
      '연락처', '이메일', '반출일', '반납일', '비고', '출고서명', '반납서명', '사진',
    ],
    rows: [],
  },
  '일반 물품 관리': {
    headers: ['No', '항목', '초기 재고수량', '출고 총갯수', '현재 잔여갯수', '비고'],
    rows: [
      ['1', '키보드', '50', '2', '48', ''],
      ['2', '마우스', '100', '0', '100', ''],
    ],
  },
  '일반 입출고 내역': {
    headers: [
      'No', '항목', '출고갯수', '출고일', '출고자', '직책', '소속',
      '연락처', '이메일', '서명',
    ],
    rows: [
      ['1', '키보드', '2', '2025-06-10', '홍길동', '대리', 'IT', '010-1234-4567', 'kim@example.com', ''],
    ],
  },
};

function sheetFromConfig(config) {
  return XLSX.utils.aoa_to_sheet([config.headers, ...config.rows]);
}

function writeWorkbook(filename, sheetsConfig) {
  const wb = XLSX.utils.book_new();
  for (const [tabName, config] of Object.entries(sheetsConfig)) {
    XLSX.utils.book_append_sheet(wb, sheetFromConfig(config), tabName);
  }
  XLSX.writeFile(wb, join(outDir, filename));
  console.log('생성:', join(outDir, filename));
}

function writeCsvFiles(prefix, sheetsConfig) {
  const csvDir = join(outDir, `${prefix}_csv`);
  mkdirSync(csvDir, { recursive: true });
  for (const [tabName, config] of Object.entries(sheetsConfig)) {
    const safeName = tabName.replace(/[\\/:*?"<>|]/g, '_');
    const ws = sheetFromConfig(config);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const bom = '\uFEFF';
    writeFileSync(join(csvDir, `${safeName}.csv`), bom + csv, 'utf8');
    console.log('생성:', join(csvDir, `${safeName}.csv`));
  }
}

writeWorkbook('Talkment_사내용_샘플.xlsx', INTERNAL_SHEETS);
writeCsvFiles('사내용', INTERNAL_SHEETS);
