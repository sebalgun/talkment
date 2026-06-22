/** 외부인용 구글 시트 탭 이름 — backend/src/constants/externalSheetNames.js 와 동기화 */
export const EXTERNAL_SHEET_TAB_NAMES = {
  RENTALS: '외부인 대여 관리',
};

export const EXTERNAL_REQUIRED_TABS = Object.values(EXTERNAL_SHEET_TAB_NAMES);

export const EXTERNAL_TAB_COPY_LIST = EXTERNAL_REQUIRED_TABS.join('\n');

/** 외부인 시트 1행 헤더 복사용 */
export const EXTERNAL_HEADER_COPY_LIST = [
  'No',
  '담당자 팀',
  '담당자 이름',
  '담당자 서명',
  '사업내용',
  '사업기간',
  '장비모델',
  '장비 시리얼',
  '장비 스펙',
  '모듈',
  '모듈 시리얼',
  '모듈 스펙',
  '업체명',
  '연락처',
  '업체 주소',
  '반출자 이름',
  '반출자 서명',
  '반납예정일',
  '반납일',
  '상태',
].join('\t');
