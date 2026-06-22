/** 온보딩 단계 상수 */
export const ONBOARDING_STEPS = {
  WORKSPACE_INFO: 'workspace_info', // 1단계: 작업 공간 이름 + 운영 유형
  SHEET_SETUP: 'sheet_setup',       // 2단계: 구글 시트 URL 연동
  TAB_MAPPING: 'tab_mapping',       // 3단계: 탭 용도 지정 + 컬럼 매핑
  COMPLETE: 'complete',             // 완료
};

/** 운영 유형 - 기존 INVENTORY_MODES와 값 동일하게 유지 */
export const OPERATION_TYPES = {
  INTERNAL: 'internal', // 내부 직원 전용
  EXTERNAL: 'external', // 외부인 혼용
};

export const OPERATION_TYPE_LABELS = {
  [OPERATION_TYPES.INTERNAL]: '내부 직원 전용',
  [OPERATION_TYPES.EXTERNAL]: '외부인 혼용',
};
