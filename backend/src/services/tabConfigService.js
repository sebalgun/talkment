/**
 * 탭 설정 서비스
 *
 * 활성 workspace의 탭 이름·필드 매핑을 조회하고,
 * 설정이 없으면 기존 하드코딩 기본값을 반환하여 하위 호환성 유지.
 */

import { getActiveWorkspace } from './onboardingStore.js';
import { DEFAULT_FIELDS, remapRows } from './fieldMapper.js';

// ─── 기본 탭 이름 (기존 하드코딩 값) ─────────────────────────

export const DEFAULT_TAB_NAMES = {
  employees:       '명단',
  serialAssets:    '시리얼 물품 관리',
  serialLog:       '시리얼 입출고 내역',
  consumableMaster:'일반 물품 관리',
  consumableLog:   '일반 입출고 내역',
};

// ─── 탭 설정 조회 ─────────────────────────────────────────────

/**
 * 활성 workspace의 탭 설정을 가져온다.
 * workspace가 없거나 tabs 설정이 없으면 기본값 사용.
 *
 * @returns {{
 *   getTabName(purpose: string): string,
 *   getFields(purpose: string): object,
 *   remap(rows: object[], purpose: string): object[],
 *   hasTab(purpose: string): boolean,
 *   operationType: string | null,
 * }}
 */
export function getTabConfig() {
  const workspace = getActiveWorkspace();
  const tabs = workspace?.tabs ?? {};
  const operationType = workspace?.operationType ?? null;

  return {
    /** 실제 시트 탭 이름 반환 (없으면 기본값) */
    getTabName(purpose) {
      return tabs[purpose]?.tabName || DEFAULT_TAB_NAMES[purpose];
    },

    /** 필드 매핑 설정 반환 (없으면 빈 객체 → fieldMapper가 기본값 사용) */
    getFields(purpose) {
      return tabs[purpose]?.fields ?? {};
    },

    /** raw rows를 표준 컬럼명으로 리매핑 */
    remap(rows, purpose) {
      return remapRows(rows, purpose, tabs[purpose]?.fields ?? {});
    },

    /** 해당 목적의 탭이 설정되어 있는지 */
    hasTab(purpose) {
      return Boolean(tabs[purpose]?.tabName);
    },

    operationType,
  };
}

/**
 * SHEET_NAMES 상수 대신 사용하는 동적 탭 이름 맵 반환.
 * 기존 코드에서 SHEET_NAMES.EMPLOYEES 대신 getSheetNames().EMPLOYEES 로 교체.
 */
export function getSheetNames() {
  const cfg = getTabConfig();
  return {
    EMPLOYEES:        cfg.getTabName('employees'),
    SERIAL_ASSETS:    cfg.getTabName('serialAssets'),
    SERIAL_LOG:       cfg.getTabName('serialLog'),
    CONSUMABLE_MASTER:cfg.getTabName('consumableMaster'),
    CONSUMABLE_LOG:   cfg.getTabName('consumableLog'),
  };
}
