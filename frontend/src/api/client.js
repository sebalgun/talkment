import {
  getSpreadsheetId,
  parseSpreadsheetId,
} from '../utils/sheetConfig';
import { getDriveFolderId } from '../utils/driveConfig';
import { INVENTORY_MODES } from '../constants/inventoryModes';

const BASE = '/api';
const AUTH_TOKEN_KEY = 'talkment_auth_token';

function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

async function parseResponseJson(res) {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      'API 서버에 연결되지 않았습니다. 시작.bat으로 서버를 실행했는지, zrok/개발 모드 포트가 맞는지 확인해 주세요.'
    );
  }
  try {
    return trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(`서버 응답을 읽을 수 없습니다. (HTTP ${res.status})`);
  }
}

function buildHeaders(extra = {}, overrideSpreadsheetId) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const id = overrideSpreadsheetId || getSpreadsheetId();
  if (id) headers['X-Spreadsheet-Id'] = id;
  headers['X-Inventory-Mode'] = INVENTORY_MODES.INTERNAL;
  const driveFolderId = getDriveFolderId();
  if (driveFolderId) headers['X-Drive-Folder-Id'] = driveFolderId;
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path, options = {}, overrideSpreadsheetId) {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: buildHeaders(options.headers, overrideSpreadsheetId),
    ...options,
  });
  const data = await parseResponseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  verifyGoogleToken: (idToken) =>
    fetch(`${BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data; // { token, user }
    }),

  getPublicConfig: () =>
    fetch(`${BASE}/config/public`).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  getAppConfig: () =>
    fetch(`${BASE}/app-config`, { cache: 'no-store' }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  saveAppConfig: (payload) =>
    fetch(`${BASE}/app-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  parseSheetId: (url) =>
    fetch(`${BASE}/sheets/parse-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  verifySheet: (spreadsheetId) =>
    fetch(`${BASE}/sheets/verify`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Spreadsheet-Id': spreadsheetId,
      },
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  getEmployees: () => request('/employees'),
  getAssets: () => request('/assets'),
  getSerialLog: () => request('/assets/log'),
  getConsumableMaster: () => request('/consumables/master'),
  getConsumableLog: () => request('/consumables/log'),

  parseVoice: (text) =>
    request('/voice/parse', { method: 'POST', body: JSON.stringify({ text }) }),

  checkout: (parsed, employee) =>
    request('/checkout', { method: 'POST', body: JSON.stringify({ parsed, employee }) }),

  searchReturns: (q) => request(`/returns/search?q=${encodeURIComponent(q)}`),

  processReturn: (item) =>
    request('/returns', { method: 'POST', body: JSON.stringify({ item }) }),

  uploadSignature: ({ sheet, rowIndex, column, base64 }) =>
    request('/signature', {
      method: 'POST',
      body: JSON.stringify({ sheet, rowIndex, column, base64 }),
    }),

  updateSheetRow: ({ tab, rowIndex, fields }) =>
    request('/sheets/rows', {
      method: 'PUT',
      body: JSON.stringify({ tab, rowIndex, fields }),
    }),

  // ── 온보딩 API (스프레드시트 ID 헤더 불필요) ──────────────

  getOnboardingStatus: () =>
    fetch(`${BASE}/onboarding/status`, { cache: 'no-store' }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  createWorkspace: ({ name, operationType }) =>
    fetch(`${BASE}/onboarding/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, operationType }),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  saveWorkspaceSheets: (workspaceId, payload) =>
    fetch(`${BASE}/onboarding/workspaces/${workspaceId}/sheets`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  completeOnboarding: (workspaceId) =>
    fetch(`${BASE}/onboarding/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  getSheetTabs: (spreadsheetId) =>
    fetch(`${BASE}/onboarding/sheet-tabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`, {
      cache: 'no-store',
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data; // { tabs: string[] }
    }),

  getSheetHeaders: (spreadsheetId, tabName) =>
    fetch(
      `${BASE}/onboarding/sheet-headers?spreadsheetId=${encodeURIComponent(spreadsheetId)}&tabName=${encodeURIComponent(tabName)}`,
      { cache: 'no-store' }
    ).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data; // { headers: string[] }
    }),

  getFieldSchema: () =>
    fetch(`${BASE}/onboarding/field-schema`, { cache: 'no-store' }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),

  saveWorkspaceTabs: (workspaceId, tabs) =>
    fetch(`${BASE}/onboarding/workspaces/${workspaceId}/tabs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs }),
    }).then(async (res) => {
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    }),
};

export { parseSpreadsheetId };
