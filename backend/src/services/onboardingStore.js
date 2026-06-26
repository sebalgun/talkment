/**
 * 온보딩 설정 스토어
 *
 * 저장 위치: backend/data/workspaces.json
 *
 * 스키마:
 * {
 *   "version": 1,
 *   "onboarding": {
 *     "completed": false,
 *     "completedAt": null,          // ISO 8601
 *     "currentStep": "workspace_info"
 *   },
 *   "workspaces": [
 *     {
 *       "id": "ws_1700000000000",
 *       "name": "자재 반출 관리",
 *       "operationType": "internal" | "external",
 *       "sheets": {
 *         "main": {
 *           "spreadsheetId": "1ABC...",
 *           "url": "https://docs.google.com/spreadsheets/d/1ABC.../edit",
 *           "title": "물품 관리"
 *         },
 *         "employees": {
 *           "spreadsheetId": "1ABC...",
 *           "url": "https://...",
 *           "title": "직원 명단",
 *           "sameAsMain": true        // main과 같은 스프레드시트일 경우 true
 *         }
 *       },
 *       "driveFolderId": null,
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "activeWorkspaceId": "ws_1700000000000"
 * }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ONBOARDING_STEPS, OPERATION_TYPES } from '../constants/onboardingSteps.js';
import { getAppConfig } from './appConfigStore.js';
import * as replitDb from './replitDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../../data/workspaces.json');

const DEFAULT_STATE = {
  version: 1,
  onboarding: {
    completed: false,
    completedAt: null,
    currentStep: ONBOARDING_STEPS.WORKSPACE_INFO,
  },
  workspaces: [],
  activeWorkspaceId: null,
};

// ─── 파일 I/O ────────────────────────────────────────────────

function ensureDir() {
  mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
}

function readRaw() {
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_STATE);
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function writeRaw(data) {
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  replitDb.set('workspaces', data); // fire and forget
}

/** Cloud Run 콜드스타트 시 Replit DB → 환경변수 순으로 설정 복원 */
export async function restoreFromDb() {
  if (existsSync(CONFIG_PATH)) return;

  // 1) Replit DB
  const dbData = await replitDb.get('workspaces');
  if (dbData) {
    ensureDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log('[Onboarding] Replit DB에서 설정 복원됨');
    return;
  }

  // 2) 환경변수 폴백 (TALKMENT_WORKSPACES=base64JSON)
  const envVal = process.env.TALKMENT_WORKSPACES;
  if (envVal) {
    try {
      const parsed = JSON.parse(Buffer.from(envVal, 'base64').toString('utf-8'));
      ensureDir();
      writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
      console.log('[Onboarding] 환경변수 TALKMENT_WORKSPACES에서 설정 복원됨');
    } catch (e) {
      console.warn('[Onboarding] TALKMENT_WORKSPACES 파싱 실패:', e.message);
    }
  }
}

// ─── 공개 API ────────────────────────────────────────────────

/**
 * 최초 실행 여부 감지
 * - 등록된 작업 공간이 없거나 온보딩이 완료되지 않은 경우 true
 * - 단, 환경변수 또는 app-config.json으로 시트가 설정된 경우 false (재배포 후 초기화 방지)
 */
export function isFirstRun() {
  const state = readRaw();
  if (state.onboarding?.completed && state.workspaces.length > 0) return false;
  const { sheet } = getAppConfig();
  if (sheet?.spreadsheetId) return false;
  return true;
}

/**
 * 현재 온보딩 상태 반환
 */
export function getOnboardingStatus() {
  const state = readRaw();
  const envSheet = getAppConfig().sheet;
  const completed =
    (state.onboarding?.completed && state.workspaces.length > 0) ||
    !!envSheet?.spreadsheetId;
  return {
    isFirstRun: !completed,
    completed,
    currentStep: state.onboarding?.currentStep ?? ONBOARDING_STEPS.WORKSPACE_INFO,
    completedAt: state.onboarding?.completedAt ?? null,
    workspaceCount: state.workspaces?.length ?? 0,
    activeWorkspaceId: state.activeWorkspaceId ?? null,
  };
}

/**
 * Step 1 — 작업 공간 이름 + 운영 유형 저장
 * @param {{ name: string, operationType: 'internal' | 'external' }} param
 * @returns {object} 생성된 workspace 객체
 */
export function createWorkspaceDraft({ name, operationType }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('작업 공간 이름을 입력해 주세요.');
  }
  if (name.trim().length > 50) {
    throw new Error('작업 공간 이름은 50자 이내로 입력해 주세요.');
  }
  if (!Object.values(OPERATION_TYPES).includes(operationType)) {
    throw new Error(`운영 유형은 'internal' 또는 'external' 중 하나여야 합니다.`);
  }

  const state = readRaw();
  const now = new Date().toISOString();
  const id = `ws_${Date.now()}`;

  const workspace = {
    id,
    name: name.trim(),
    operationType,
    sheets: { main: null, employees: null },
    driveFolderId: null,
    createdAt: now,
    updatedAt: now,
  };

  state.workspaces = [...(state.workspaces ?? []), workspace];
  state.onboarding.currentStep = ONBOARDING_STEPS.SHEET_SETUP;
  writeRaw(state);

  return workspace;
}

/**
 * Step 2 — 구글 시트 연동 정보 저장
 *
 * employees를 지정하지 않으면 main 스프레드시트의 '명단' 탭을 사용한다고 간주.
 * employees를 별도 스프레드시트로 지정하면 해당 ID를 저장.
 * (별도 시트 실제 라우팅 지원은 추후 작업)
 *
 * @param {string} workspaceId
 * @param {{ main: object, employees?: object, driveFolderId?: string }} param
 * @returns {object} 업데이트된 workspace 객체
 */
export function saveWorkspaceSheets(workspaceId, { main, employees, driveFolderId }) {
  if (!main?.spreadsheetId) {
    throw new Error('물품 리스트 시트 ID가 필요합니다.');
  }

  const state = readRaw();
  const idx = state.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) {
    throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);
  }

  const workspace = state.workspaces[idx];

  workspace.sheets.main = {
    spreadsheetId: main.spreadsheetId,
    url: main.url ?? `https://docs.google.com/spreadsheets/d/${main.spreadsheetId}/edit`,
    title: main.title ?? '물품 관리',
  };

  const hasSeparateEmployeeSheet =
    employees?.spreadsheetId && employees.spreadsheetId !== main.spreadsheetId;

  if (hasSeparateEmployeeSheet) {
    workspace.sheets.employees = {
      spreadsheetId: employees.spreadsheetId,
      url: employees.url ?? `https://docs.google.com/spreadsheets/d/${employees.spreadsheetId}/edit`,
      title: employees.title ?? '직원 명단',
      sameAsMain: false,
    };
  } else {
    // 별도 시트 미지정 → main 스프레드시트의 '명단' 탭 사용
    workspace.sheets.employees = {
      spreadsheetId: main.spreadsheetId,
      url: workspace.sheets.main.url,
      title: '명단',
      sameAsMain: true,
    };
  }

  if (driveFolderId) workspace.driveFolderId = driveFolderId;
  workspace.updatedAt = new Date().toISOString();

  state.workspaces[idx] = workspace;
  writeRaw(state);

  return workspace;
}

/**
 * Step 3 — 탭 용도 지정 + 컬럼 매핑 저장
 *
 * tabs 형식:
 * {
 *   employees:        { tabName: '사원명단', fields: { name: '이름', email: '이메일주소', ... } },
 *   serialAssets:     { tabName: '노트북목록', fields: { itemName: '품목', serialNumber: 'S/N', ... } },
 *   serialLog:        { tabName: '노트북입출고', fields: { ... } },
 *   consumableMaster: { tabName: '소모품', fields: { ... } },   // 선택
 *   consumableLog:    { tabName: '소모품이력', fields: { ... } }, // 선택
 * }
 *
 * @param {string} workspaceId
 * @param {object} tabs
 */
export function saveWorkspaceTabs(workspaceId, tabs) {
  if (!tabs || typeof tabs !== 'object') {
    throw new Error('탭 설정이 올바르지 않습니다.');
  }

  const state = readRaw();
  const idx = state.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);

  state.workspaces[idx].tabs = tabs;
  state.workspaces[idx].updatedAt = new Date().toISOString();
  state.onboarding.currentStep = ONBOARDING_STEPS.TAB_MAPPING;
  writeRaw(state);

  return state.workspaces[idx];
}

/**
 * 온보딩 완료 처리
 * - 해당 workspaceId가 active로 설정됨
 * @param {string} workspaceId
 */
export function completeOnboarding(workspaceId) {
  const state = readRaw();
  const workspace = state.workspaces.find((w) => w.id === workspaceId);

  if (!workspace) {
    throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);
  }
  if (!workspace.sheets?.main?.spreadsheetId) {
    throw new Error('시트 연동이 완료되지 않았습니다. 먼저 구글 시트를 연결해 주세요.');
  }

  state.onboarding.completed = true;
  state.onboarding.completedAt = new Date().toISOString();
  state.onboarding.currentStep = ONBOARDING_STEPS.COMPLETE;
  state.activeWorkspaceId = workspaceId;

  writeRaw(state);
  return { completed: true, activeWorkspaceId: workspaceId, workspace };
}

/**
 * 전체 작업 공간 목록 + 현재 활성 ID 반환
 */
export function listWorkspaces() {
  const state = readRaw();
  return {
    workspaces: state.workspaces ?? [],
    activeWorkspaceId: state.activeWorkspaceId ?? null,
  };
}

/**
 * 특정 작업 공간 반환 (없으면 null)
 */
export function getWorkspace(workspaceId) {
  const state = readRaw();
  return state.workspaces.find((w) => w.id === workspaceId) ?? null;
}

/**
 * 현재 활성 작업 공간 반환 (없으면 null)
 */
export function getActiveWorkspace() {
  const state = readRaw();
  if (!state.activeWorkspaceId) return null;
  return state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? null;
}

/**
 * 워크스페이스 활성화 — activeWorkspaceId + app-config.json 동기화
 */
export function activateWorkspace(workspaceId) {
  const state = readRaw();
  const workspace = state.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);

  state.activeWorkspaceId = workspaceId;
  writeRaw(state);
  return workspace;
}

/**
 * 재고 관리 유형 저장 (시리얼 / 소모품 / 둘 다)
 * @param {string} workspaceId
 * @param {'serial' | 'consumable' | 'both'} inventoryType
 */
export function updateWorkspaceInventoryType(workspaceId, inventoryType) {
  const VALID = ['serial', 'consumable', 'both'];
  if (!VALID.includes(inventoryType)) {
    throw new Error(`inventoryType은 ${VALID.join(', ')} 중 하나여야 합니다.`);
  }
  const state = readRaw();
  const idx = state.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);
  state.workspaces[idx].inventoryType = inventoryType;
  state.workspaces[idx].updatedAt = new Date().toISOString();
  writeRaw(state);
  return state.workspaces[idx];
}

const DEFAULT_FIELD_OPTIONS = {
  requireSignature: true,
  trackReturnDue: true,
};

/**
 * 활성 작업 공간의 fieldOptions 반환
 */
export function getActiveFieldOptions() {
  const workspace = getActiveWorkspace();
  return { ...DEFAULT_FIELD_OPTIONS, ...(workspace?.fieldOptions ?? {}) };
}

/**
 * 작업 공간 필드 옵션(출고 폼 설정) 저장
 * @param {string} workspaceId
 * @param {object} fieldOptions — { requireSignature, trackReturnDue }
 */
export function updateWorkspaceFieldOptions(workspaceId, fieldOptions) {
  const state = readRaw();
  const idx = state.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);
  state.workspaces[idx].fieldOptions = { ...DEFAULT_FIELD_OPTIONS, ...fieldOptions };
  state.workspaces[idx].updatedAt = new Date().toISOString();
  writeRaw(state);
  return state.workspaces[idx];
}

/**
 * 작업 공간 삭제
 * - 마지막 workspace 삭제 시 온보딩 상태 초기화
 * - active였던 경우 다음 workspace가 active로 승격
 */
export function deleteWorkspace(workspaceId) {
  const state = readRaw();
  const before = state.workspaces.length;
  state.workspaces = state.workspaces.filter((w) => w.id !== workspaceId);

  if (state.workspaces.length === before) {
    throw new Error(`작업 공간을 찾을 수 없습니다: ${workspaceId}`);
  }

  if (state.activeWorkspaceId === workspaceId) {
    state.activeWorkspaceId = state.workspaces[0]?.id ?? null;
  }

  if (state.workspaces.length === 0) {
    state.onboarding.completed = false;
    state.onboarding.completedAt = null;
    state.onboarding.currentStep = ONBOARDING_STEPS.WORKSPACE_INFO;
  }

  writeRaw(state);
}
