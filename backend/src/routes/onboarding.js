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
  activateWorkspace,
  getActiveFieldOptions,
  updateWorkspaceFieldOptions,
} from '../services/onboardingStore.js';
import { fetchSheetRows } from '../services/googleSheets.js';

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
 * PATCH /api/onboarding/workspaces/:id/activate
 * 워크스페이스 활성화 — activeWorkspaceId 전환 + app-config 동기화
 */
router.patch('/workspaces/:id/activate', (req, res) => {
  try {
    const workspace = activateWorkspace(req.params.id);
    // app-config.json 동기화 — spreadsheetMiddleware가 이 값을 사용
    if (workspace?.sheets?.main?.spreadsheetId) {
      saveAppConfig({
        sheet: {
          spreadsheetId: workspace.sheets.main.spreadsheetId,
          url: workspace.sheets.main.url,
          title: workspace.sheets.main.title,
          alias: workspace.name,
        },
      });
    }
    res.json(workspace);
  } catch (e) {
    const status = e.message.includes('찾을 수 없습니다') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

/**
 * GET /api/onboarding/workspaces/:id/card-stats
 * 프로젝트 카드용 간략 통계 — activeWorkspaceId 변경 없이 조회
 */
router.get('/workspaces/:id/card-stats', async (req, res, next) => {
  try {
    const workspace = getWorkspace(req.params.id);
    if (!workspace) return res.status(404).json({ error: '작업 공간을 찾을 수 없습니다.' });

    const spreadsheetId = workspace.sheets?.main?.spreadsheetId;
    if (!spreadsheetId) return res.json({ itemCount: 0, unreturned: 0, lowStock: 0 });

    // 새 3-탭 구조([물품관리]) 우선, 없으면 기존 탭명 폴백
    const inventoryType = workspace.inventoryType || 'both';
    const tabs = workspace.tabs || {};

    const masterTabName = tabs.serialAssets?.tabName || '물품관리';
    const logTabName    = tabs.serialLog?.tabName    || '반출이력';
    const consumeTab    = tabs.consumableMaster?.tabName || '물품관리';

    const [masterRows, logRows] = await Promise.all([
      fetchSheetRows(masterTabName, spreadsheetId),
      fetchSheetRows(logTabName, spreadsheetId),
    ]);

    // 구 구조 폴백: 물품관리 탭이 비어 있으면 시리얼/일반 따로 읽기
    let items = masterRows;
    if (items.length === 0 && inventoryType !== 'consumable') {
      items = await fetchSheetRows('시리얼 물품 관리', spreadsheetId);
    }
    if (items.length === 0 && inventoryType !== 'serial') {
      const consumableItems = await fetchSheetRows('일반 물품 관리', spreadsheetId);
      items = [...items, ...consumableItems];
    }

    // 로그 폴백
    let log = logRows;
    if (log.length === 0) {
      log = await fetchSheetRows('시리얼 입출고 내역', spreadsheetId);
    }

    // 재고 부족 판별 — 최소 재고 수량 컬럼 있는 경우
    const today = new Date().toISOString().slice(0, 10);
    const itemCount = items.length;
    const unreturned = log.filter((r) => {
      const returned = String(r['반납일'] || r['반납'] || '').trim();
      return !returned;
    }).length;
    const lowStock = items.filter((r) => {
      const min = parseInt(r['최소 재고 수량'] || r['최소재고'] || '', 10);
      const cur = parseInt(r['재고 수량'] || r['현재 잔여갯수'] || r['수량'] || '', 10);
      return !isNaN(min) && !isNaN(cur) && cur < min;
    }).length;

    res.json({ itemCount, unreturned, lowStock });
  } catch (e) {
    next(e);
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
 * GET /api/onboarding/active/field-options
 * 현재 활성 작업 공간의 fieldOptions 반환
 */
router.get('/active/field-options', (_req, res) => {
  res.json(getActiveFieldOptions());
});

/**
 * PATCH /api/onboarding/workspaces/:id/field-options
 * 출고 폼 설정(서명 요구, 반납예정일 등) 저장
 */
router.patch('/workspaces/:id/field-options', (req, res) => {
  try {
    const { fieldOptions } = req.body ?? {};
    if (!fieldOptions || typeof fieldOptions !== 'object') {
      return res.status(400).json({ error: 'fieldOptions 객체가 필요합니다.' });
    }
    const workspace = updateWorkspaceFieldOptions(req.params.id, fieldOptions);
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
