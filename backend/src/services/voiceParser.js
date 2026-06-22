import OpenAI from 'openai';
import { config } from '../config/env.js';
import { getActiveWorkspace } from './onboardingStore.js';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { masterStore } from './masterDataStore.js';
import { findEmployeesByName } from './sheetParser.js';

const SYSTEM_PROMPT = `당신은 재고관리 음성 명령 파서입니다.
관리자의 한국어 음성 명령을 JSON으로 구조화하세요.

출력 JSON 스키마:
{
  "intent": "checkout" | "return" | "query",
  "itemType": "serial" | "consumable",
  "itemName": "품목명 (예: 모니터, 모자)",
  "serialNumber": "시리얼 번호 (1대만 언급된 경우)",
  "serialNumbers": ["시리얼 번호 배열 (여러 대일 때, 없으면 빈 배열)"],
  "quantity": 숫자 ("2대", "3개" 등 — 시리얼·소모품 공통, 기본 1),
  "employeeName": "출고자 이름",
  "department": "소속 (언급된 경우)",
  "title": "직함 (언급된 경우)",
  "returnDueDate": "YYYY-MM-DD (반납 예정일)"
}

오늘 날짜: ${new Date().toISOString().slice(0, 10)}
"6월 15일" 같은 표현은 올해 기준 YYYY-MM-DD로 변환하세요.
JSON만 출력하세요.`;

/** GPT 또는 mock으로 음성 텍스트 파싱 */
export async function parseVoiceCommand(text) {
  let parsed;

  if (config.openai.apiKey) {
    const openai = new OpenAI({ apiKey: config.openai.apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    parsed = JSON.parse(completion.choices[0].message.content);
  } else {
    parsed = mockParse(text);
  }

  // 직원 명단은 캐시에서 조회 (매 음성 명령마다 Sheets API 호출 방지)
  const spreadsheetId = getSpreadsheetId();
  const employees = await masterStore.loadEmployees(spreadsheetId);
  const matches = findEmployeesByName(employees, parsed.employeeName);

  return {
    parsed,
    employeeMatches: matches,
    needsDisambiguation: matches.length > 1,
  };
}

/** OpenAI 키 없을 때 사용하는 간단한 mock 파서 */
function mockParse(text) {
  const intent = text.includes('반납') ? 'return' : 'checkout';

  const nameMatch = text.match(/([가-힣]{2,4})\s*(?:대리|과장|팀장|사원|차장|부장)?/);
  const deptMatch = text.match(/([가-힣A-Za-z]+팀)/);
  const serialMatch = text.match(/(\d+-\d+)/);
  const dateMatch = text.match(/(\d+)월\s*(\d+)일/);
  const qtyMatch = text.match(/(\d+)\s*(?:개|대)/);

  const itemKeywords = ['모니터', 'PC', '노트북', '모자', '장갑', '키보드', '마우스'];
  const foundItem = itemKeywords.find((k) => text.includes(k));

  let returnDueDate = '';
  if (dateMatch) {
    const year = new Date().getFullYear();
    returnDueDate = `${year}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
  }

  const consumables = ['모자', '장갑'];
  const itemType = foundItem && consumables.includes(foundItem) ? 'consumable' : 'serial';

  return {
    intent,
    itemType,
    itemName: foundItem || '',
    serialNumber: serialMatch ? serialMatch[1] : '',
    quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
    employeeName: nameMatch ? nameMatch[1] : '',
    department: deptMatch ? deptMatch[1] : '',
    title: '',
    returnDueDate,
  };
}

/** Whisper API로 오디오 → 텍스트 (선택) */
export async function transcribeAudio(buffer, mimetype = 'audio/webm') {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY가 필요합니다 (Whisper STT).');
  }
  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const ext = mimetype.includes('webm') ? 'webm' : 'mp4';
  const file = new File([buffer], `audio.${ext}`, { type: mimetype });
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'ko',
  });
  return transcription.text;
}
