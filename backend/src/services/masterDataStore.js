/**
 * 마스터 데이터 인메모리 스토어
 *
 * 자주 읽히지만 드물게 변경되는 시트 데이터를 TTL 캐시에 보관한다.
 * Google Sheets API 호출 횟수를 줄이고 응답 속도를 높이는 것이 목적.
 *
 * 캐시 키: `${spreadsheetId}::${type}`
 *
 * 사용 규칙:
 *  - 읽기  : loadEmployees / loadSerialAssets / loadConsumableAssets (TTL 내 캐시 우선)
 *  - 쓰기 후: invalidate(spreadsheetId) 호출하여 다음 읽기 시 갱신 유도
 *  - 시작 시: preloadAll()로 첫 요청 전 워밍업
 */

import { fetchSheetRowsById } from './googleSheets.js';
import { getTabConfig } from './tabConfigService.js';
import {
  parseEmployees,
  parseSerialAssets,
  parseConsumableAssets,
} from './sheetParser.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분

export const STORE_TYPE = {
  EMPLOYEES: 'employees',
  SERIAL_ASSETS: 'serial_assets',
  CONSUMABLE_ASSETS: 'consumable_assets',
};

class MasterDataStore {
  constructor() {
    /**
     * @type {Map<string, {
     *   data: object[],
     *   loadedAt: number,
     *   type: string,
     *   spreadsheetId: string
     * }>}
     */
    this._cache = new Map();
  }

  // ── 내부 헬퍼 ──────────────────────────────────────────────

  _key(spreadsheetId, type) {
    return `${spreadsheetId}::${type}`;
  }

  _get(spreadsheetId, type) {
    return this._cache.get(this._key(spreadsheetId, type)) ?? null;
  }

  _set(spreadsheetId, type, data) {
    this._cache.set(this._key(spreadsheetId, type), {
      data,
      loadedAt: Date.now(),
      type,
      spreadsheetId,
    });
  }

  _isStale(entry, ttl) {
    return Date.now() - entry.loadedAt > ttl;
  }

  async _load(spreadsheetId, type, sheetName, parseFn, options = {}) {
    const { force = false, ttl = DEFAULT_TTL_MS } = options;
    const cached = this._get(spreadsheetId, type);

    if (cached && !force && !this._isStale(cached, ttl)) {
      return cached.data;
    }

    const rawRows = await fetchSheetRowsById(spreadsheetId, sheetName);
    const parsed = parseFn(rawRows);
    this._set(spreadsheetId, type, parsed);

    const reason = force ? '강제' : cached ? 'TTL 만료' : '최초 로드';
    console.log(
      `[MasterStore] ${type} 로드 (${spreadsheetId.slice(0, 8)}…) — ${parsed.length}행 [${reason}]`
    );
    return parsed;
  }

  // ── 공개 API ───────────────────────────────────────────────

  /**
   * 직원 명단 로드 (캐시 우선)
   *
   * @param {string} spreadsheetId   — 직원 명단이 있는 스프레드시트 ID
   * @param {{ force?: boolean, ttl?: number }} [options]
   * @returns {Promise<ReturnType<import('./sheetParser.js').parseEmployees>>}
   */
  loadEmployees(spreadsheetId, options = {}) {
    const cfg = getTabConfig();
    const tabName = cfg.getTabName('employees');
    const parseFn = (rows) => parseEmployees(cfg.remap(rows, 'employees'));
    return this._load(spreadsheetId, STORE_TYPE.EMPLOYEES, tabName, parseFn, options);
  }

  /**
   * 시리얼 물품 목록 로드 (캐시 우선)
   *
   * @param {string} spreadsheetId
   * @param {{ force?: boolean, ttl?: number }} [options]
   */
  loadSerialAssets(spreadsheetId, options = {}) {
    const cfg = getTabConfig();
    const tabName = cfg.getTabName('serialAssets');
    const parseFn = (rows) => parseSerialAssets(cfg.remap(rows, 'serialAssets'));
    return this._load(spreadsheetId, STORE_TYPE.SERIAL_ASSETS, tabName, parseFn, options);
  }

  /**
   * 소모품 목록 로드 (캐시 우선)
   *
   * @param {string} spreadsheetId
   * @param {{ force?: boolean, ttl?: number }} [options]
   */
  loadConsumableAssets(spreadsheetId, options = {}) {
    const cfg = getTabConfig();
    const tabName = cfg.getTabName('consumableMaster');
    const parseFn = (rows) => parseConsumableAssets(cfg.remap(rows, 'consumableMaster'));
    return this._load(spreadsheetId, STORE_TYPE.CONSUMABLE_ASSETS, tabName, parseFn, options);
  }

  /**
   * API 호출 없이 현재 캐시 반환 (미로드 시 null)
   * 빠른 체크가 필요할 때 사용.
   */
  getCached(spreadsheetId, type) {
    return this._get(spreadsheetId, type)?.data ?? null;
  }

  /**
   * 모든 마스터 데이터를 병렬 프리로드
   *
   * @param {string} mainSpreadsheetId    — 물품·소모품 시트 ID
   * @param {string} [employeesSheetId]   — 직원 명단 시트 ID (생략 시 main과 동일)
   * @param {object} [options]
   * @returns {Promise<{ employees, serialAssets, consumableAssets }>}
   */
  async preloadAll(mainSpreadsheetId, employeesSheetId, options = {}) {
    const empId = employeesSheetId || mainSpreadsheetId;
    const opts = { ...options, force: true };

    const settle = (label) => (e) => {
      console.warn(`[MasterStore] ${label} 프리로드 실패:`, e.message);
      return [];
    };

    const [employees, serialAssets, consumableAssets] = await Promise.all([
      this.loadEmployees(empId, opts).catch(settle('직원 명단')),
      this.loadSerialAssets(mainSpreadsheetId, opts).catch(settle('시리얼 물품')),
      this.loadConsumableAssets(mainSpreadsheetId, opts).catch(settle('소모품')),
    ]);

    return { employees, serialAssets, consumableAssets };
  }

  /**
   * 특정 스프레드시트의 캐시 무효화
   * 출고·반납 등 시트 쓰기 이후 반드시 호출한다.
   *
   * @param {string} spreadsheetId
   */
  invalidate(spreadsheetId) {
    let count = 0;
    for (const key of this._cache.keys()) {
      if (key.startsWith(spreadsheetId)) {
        this._cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[MasterStore] 캐시 무효화: ${spreadsheetId.slice(0, 8)}… (${count}개 항목)`);
    }
  }

  /** 전체 캐시 초기화 */
  invalidateAll() {
    const count = this._cache.size;
    this._cache.clear();
    console.log(`[MasterStore] 전체 캐시 초기화 (${count}개)`);
  }

  /**
   * 현재 캐시 상태 진단
   * @returns {Array<{ key, type, rowCount, loadedAt, ageSeconds }>}
   */
  status() {
    return [...this._cache.entries()].map(([key, entry]) => ({
      key,
      type: entry.type,
      spreadsheetId: entry.spreadsheetId,
      rowCount: entry.data.length,
      loadedAt: new Date(entry.loadedAt).toISOString(),
      ageSeconds: Math.floor((Date.now() - entry.loadedAt) / 1000),
    }));
  }
}

/** 싱글턴 — 프로세스 전체에서 하나의 캐시 인스턴스 공유 */
export const masterStore = new MasterDataStore();
