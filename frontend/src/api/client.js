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
      'API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.'
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

/** 인증 토큰 포함 fetch — spreadsheetId 헤더 불필요한 보호 엔드포인트용 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { cache: 'no-store', ...options, headers });
  const data = await parseResponseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('talkment_auth_error'));
    }
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

  getAppConfig: () => authFetch(`${BASE}/app-config`),

  saveAppConfig: (payload) =>
    authFetch(`${BASE}/app-config`, { method: 'PUT', body: JSON.stringify(payload) }),

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
    authFetch(`${BASE}/sheets/verify`, {
      headers: { 'X-Spreadsheet-Id': spreadsheetId },
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

  getDashboardStats: () => request('/dashboard/stats'),

  exportConfig: () => authFetch(`${BASE}/app-config/export`),

  // ── 온보딩 API (스프레드시트 ID 헤더 불필요) ──────────────

  getOnboardingStatus: () => authFetch(`${BASE}/onboarding/status`),

  createWorkspace: ({ name, operationType }) =>
    authFetch(`${BASE}/onboarding/workspace`, {
      method: 'POST',
      body: JSON.stringify({ name, operationType }),
    }),

  saveWorkspaceSheets: (workspaceId, payload) =>
    authFetch(`${BASE}/onboarding/workspaces/${workspaceId}/sheets`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  completeOnboarding: (workspaceId) =>
    authFetch(`${BASE}/onboarding/complete`, {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    }),

  getSheetTabs: (spreadsheetId) =>
    authFetch(`${BASE}/onboarding/sheet-tabs?spreadsheetId=${encodeURIComponent(spreadsheetId)}`),

  getSheetHeaders: (spreadsheetId, tabName) =>
    authFetch(
      `${BASE}/onboarding/sheet-headers?spreadsheetId=${encodeURIComponent(spreadsheetId)}&tabName=${encodeURIComponent(tabName)}`
    ),

  getFieldSchema: () => authFetch(`${BASE}/onboarding/field-schema`),

  saveWorkspaceTabs: (workspaceId, tabs) =>
    authFetch(`${BASE}/onboarding/workspaces/${workspaceId}/tabs`, {
      method: 'PATCH',
      body: JSON.stringify({ tabs }),
    }),

  updateInventoryType: (workspaceId, inventoryType) =>
    authFetch(`${BASE}/onboarding/workspaces/${workspaceId}/inventory-type`, {
      method: 'PATCH',
      body: JSON.stringify({ inventoryType }),
    }),
};

export { parseSpreadsheetId };
