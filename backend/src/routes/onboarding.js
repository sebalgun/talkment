import { Router } from 'express';
import { parseSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { saveAppConfig } from '../services/appConfigStore.js';
import { getSheetTabNames, getSheetHeaders } from '../services/googleSheets.js';
import { FIELD_SCHEMA } from '../services/fieldMapper.js';
import {
  getOnboardingStatus,
  createWorkspaceDraft,
  saveWorkspaceSheets,
  saveWorkspaceTabs,
  completeOnboarding,
  listWorkspaces,
  getWorkspace,
  deleteWorkspace,
  updateWorkspaceInventoryType,
} from '../services/onboardingStore.js';

const router = Router();

/**
 * GET /api/onboarding/status
 * 최초 실행 여부 + 현재 온보딩 단계 반환
 *
 * Response:
 *   { isFirstRun, completed, currentStep, completedAt, workspaceCount, activeWorkspaceId }
 */
router.get('/status', (_req, res) => {
  res.json(getOnboardingStatus());
});

/**
 * GET /api/onboarding/workspaces
 * 전체 작업 공간 목록
 */
router.get('/workspaces', (_req, res) => {
  res.json(listWorkspaces());
});

/**
 * GET /api/onboarding/workspaces/:id
 * 특정 작업 공간 조회
 */
router.get('/workspaces/:id', (req, res) => {
  const workspace = getWorkspace(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: '작업 공간을 찾을 수 없습니다.' });
  }
  res.json(workspace);
});

/**
 * POST /api/onboarding/workspace
 * Step 1 — 작업 공간 이름 + 운영 유형 등록
 *
 * Body: { name: string, operationType: 'internal' | 'external' }
 * Response: 생성된 workspace 객체 (id 포함)
 */
router.post('/workspace', (req, res) => {
  try {
    const { name, operationType } = req.body ?? {};
    const workspace = createWorkspaceDraft({ name, operationType });
    res.status(201).json(workspace);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/onboarding/workspaces/:id/sheets
 * Step 2 — 구글 시트 연동 정보 저장
 *
 * Body:
 *   main     : { spreadsheetId?, url?, title? }  ← url 또는 spreadsheetId 중 하나 필수
 *   employees: { spreadsheetId?, url?, title? }  ← 생략 시 main 시트의 '명단' 탭 사용
 *   driveFolderId?: string                        ← 서명 이미지 저장용 드라이브 폴더 (선택)
 *
 * Response: 업데이트된 workspace 객체
 */
router.patch('/workspaces/:id/sheets', (req, res) => {
  try {
    const { id } = req.params;
    const { main = {}, employees, driveFolderId } = req.body ?? {};

    // URL로 입력받은 경우 ID 자동 추출
    if (main.url && !main.spreadsheetId) {
      main.spreadsheetId = parseSpreadsheetId(main.url);
    }
    if (employees?.url && !employees?.spreadsheetId) {
      employees.spreadsheetId = parseSpreadsheetId(employees.url);
    }

    if (!main.spreadsheetId) {
      return res.status(400).json({
        error: '올바른 물품 리스트 시트 URL 또는 ID를 입력해 주세요.',
      });
    }

    const workspace = saveWorkspaceSheets(id, { main, employees, driveFolderId });
    res.json(workspace);
  } catch (err) {
    const status = err.message.includes('찾을 수 없습니다') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/onboarding/complete
 * 온보딩 완료 처리
 * - 기존 app-config 시스템(app-config.json)과 동기화하여 하위 호환 유지
 *
 * Body: { workspaceId: string }
 * Response: { completed: true, activeWorkspaceId, workspace }
 */
router.post('/complete', (req, res) => {
  try {
    const { workspaceId } = req.body ?? {};
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId가 필요합니다.' });
    }

    const result = completeOnboarding(workspaceId);

    // 기존 라우팅 시스템(app-config.json)과 동기화 — spreadsheetMiddleware가 이 값을 사용
    const { workspace } = result;
    if (workspace?.sheets?.main) {
      saveAppConfig({
        sheet: {
          spreadsheetId: workspace.sheets.main.spreadsheetId,
          url: workspace.sheets.main.url,
          title: workspace.sheets.main.title,
          alias: workspace.name,
        },
        driveFolderId: workspace.driveFolderId ?? undefined,
      });
    }

    res.json(result);
  } catch (err) {
    const status = err.message.includes('찾을 수 없습니다') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/**
 * GET /api/onboarding/sheet-tabs?spreadsheetId=xxx
 * 스프레드시트의 탭 이름 목록 반환 (온보딩 3단계 UI용)
 */
router.get('/sheet-tabs', async (req, res, next) => {
  try {
    const { spreadsheetId, url } = req.query;
    const id = spreadsheetId || parseSpreadsheetId(url);
    if (!id) return res.status(400).json({ error: 'spreadsheetId 또는 url이 필요합니다.' });
    const tabs = await getSheetTabNames(id);
    res.json({ tabs });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/onboarding/sheet-headers?spreadsheetId=xxx&tabName=yyy
 * 특정 탭의 헤더(컬럼명) 목록 반환 (온보딩 컬럼 매핑 UI용)
 */
router.get('/sheet-headers', async (req, res, next) => {
  try {
    const { spreadsheetId, tabName } = req.query;
    if (!spreadsheetId || !tabName) {
      return res.status(400).json({ error: 'spreadsheetId와 tabName이 필요합니다.' });
    }
    const headers = await getSheetHeaders(spreadsheetId, tabName);
    res.json({ headers });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/onboarding/field-schema
 * 탭 목적별 필수/선택 필드 스키마 반환 (온보딩 컬럼 매핑 UI용)
 */
router.get('/field-schema', (_req, res) => {
  res.json(FIELD_SCHEMA);
});

/**
 * PATCH /api/onboarding/workspaces/:id/tabs
 * Step 3 — 탭 용도 지정 + 컬럼 매핑 저장
 *
 * Body:
 *   tabs: {
 *     employees:        { tabName, fields: { name, email, ... } },
 *     serialAssets:     { tabName, fields: { itemName, serialNumber, ... } },
 *     serialLog:        { tabName, fields: { ... } },
 *     consumableMaster: { tabName, fields: { ... } },  // 선택
 *     consumableLog:    { tabName, fields: { ... } },  // 선택
 *   }
 */
router.patch('/workspaces/:id/tabs', (req, res) => {
  try {
    const { tabs } = req.body ?? {};
    if (!tabs) return res.status(400).json({ error: 'tabs 설정이 필요합니다.' });
    const workspace = saveWorkspaceTabs(req.params.id, tabs);
    res.json(workspace);
  } catch (e) {
    const status = e.message.includes('찾을 수 없습니다') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

/**
 * PATCH /api/onboarding/workspaces/:id/inventory-type
 * 재고 관리 유형 설정 — serial | consumable | both
 */
router.patch('/workspaces/:id/inventory-type', (req, res) => {
  try {
    const { inventoryType } = req.body ?? {};
    if (!inventoryType) return res.status(400).json({ error: 'inventoryType이 필요합니다.' });
    const workspace = updateWorkspaceInventoryType(req.params.id, inventoryType);
    res.json(workspace);
  } catch (e) {
    const status = e.message.includes('찾을 수 없습니다') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

/**
 * DELETE /api/onboarding/workspaces/:id
 * 작업 공간 삭제 (마지막 삭제 시 온보딩 초기화)
 */
router.delete('/workspaces/:id', (req, res) => {
  try {
    deleteWorkspace(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
