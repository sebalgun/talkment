import { INVENTORY_MODES } from '../constants/inventoryModes.js';

const STORE_KEY = 'inventory_modes_v3';
const LEGACY_KEYS = [
  'inventory_sheets_v2',
  'inventory_spreadsheet_id',
  'inventory_spreadsheet_url',
  'inventory_spreadsheet_title',
];

function emptyStore() {
  return {
    internal: null,
    activeMode: INVENTORY_MODES.INTERNAL,
  };
}

function loadStore() {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      internal: parsed.internal || null,
      activeMode: INVENTORY_MODES.INTERNAL,
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({ internal: store.internal, activeMode: INVENTORY_MODES.INTERNAL })
  );
}

function createSheetEntry({ spreadsheetId, url, title, alias }) {
  return {
    id: crypto.randomUUID(),
    role: INVENTORY_MODES.INTERNAL,
    spreadsheetId,
    url: url || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    title: title || '제목 없음',
    alias: alias || title || '사내 자산',
    addedAt: Date.now(),
  };
}

function migrateLegacy() {
  if (localStorage.getItem(STORE_KEY)) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      if (parsed.external) {
        const store = { internal: parsed.internal, activeMode: INVENTORY_MODES.INTERNAL };
        saveStore(store);
      }
    } catch {
      /* ignore */
    }
    return;
  }

  const rawV2 = localStorage.getItem('inventory_sheets_v2');
  if (rawV2) {
    try {
      const v2 = JSON.parse(rawV2);
      const store = emptyStore();
      if (v2.sheets?.[0]) {
        store.internal = { ...v2.sheets[0], role: INVENTORY_MODES.INTERNAL };
      }
      saveStore(store);
      return;
    } catch {
      /* fall through */
    }
  }

  const oldId = localStorage.getItem('inventory_spreadsheet_id');
  if (!oldId) return;

  saveStore({
    internal: createSheetEntry({
      spreadsheetId: oldId,
      url: localStorage.getItem('inventory_spreadsheet_url'),
      title: localStorage.getItem('inventory_spreadsheet_title') || '사내 자산',
      alias: localStorage.getItem('inventory_spreadsheet_title') || '사내 자산',
    }),
    activeMode: INVENTORY_MODES.INTERNAL,
  });

  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function parseSpreadsheetId(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

export function getActiveMode() {
  return INVENTORY_MODES.INTERNAL;
}

export function setActiveMode(mode) {
  if (mode !== INVENTORY_MODES.INTERNAL) {
    throw new Error('사내용 모드만 지원합니다.');
  }
  return INVENTORY_MODES.INTERNAL;
}

export function getSheetByMode(mode) {
  if (mode && mode !== INVENTORY_MODES.INTERNAL) return null;
  return loadStore().internal;
}

export function getActiveSheet() {
  return loadStore().internal;
}

export function getSpreadsheetId() {
  return getActiveSheet()?.spreadsheetId || null;
}

export function getSpreadsheetUrl() {
  return getActiveSheet()?.url || null;
}

export function isModeConfigured(mode) {
  if (mode && mode !== INVENTORY_MODES.INTERNAL) return false;
  return Boolean(getActiveSheet()?.spreadsheetId);
}

export function isSheetConfigured() {
  return isModeConfigured(INVENTORY_MODES.INTERNAL);
}

export function registerSheet(_mode, { spreadsheetId, url, title, alias }) {
  const store = loadStore();
  store.internal = createSheetEntry({ spreadsheetId, url, title, alias });
  saveStore(store);
  return store.internal;
}

export function removeSheet(mode) {
  if (mode && mode !== INVENTORY_MODES.INTERNAL) return loadStore();
  const store = loadStore();
  store.internal = null;
  saveStore(store);
  return store;
}

export function clearAllSheets() {
  localStorage.removeItem(STORE_KEY);
}

/** @deprecated */
export function addSheet(payload) {
  return registerSheet(INVENTORY_MODES.INTERNAL, payload);
}

/** @deprecated */
export function setActiveSheet() {
  return getActiveSheet();
}

/** @deprecated */
export function saveSheetConfig(payload) {
  return registerSheet(INVENTORY_MODES.INTERNAL, payload);
}

/** @deprecated */
export function clearSheetConfig() {
  clearAllSheets();
}
