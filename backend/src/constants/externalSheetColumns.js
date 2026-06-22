/** 외부인 대여 탭 컬럼 — frontend/src/constants/externalSheetColumns.js 와 동기화 */
export const EXTERNAL_TAB_CONFIG = {
  externalRentals: {
    label: '외부인 대여 관리',
    columns: [
      { key: 'No', editable: false },
      { key: '담당자 팀', editable: true },
      { key: '담당자 이름', editable: true },
      { key: '담당자 서명', editable: false },
      { key: '사업내용', editable: true },
      { key: '사업기간', editable: true },
      { key: '장비모델', editable: true },
      { key: '장비 시리얼', editable: true },
      { key: '장비 스펙', editable: true },
      { key: '모듈', editable: true },
      { key: '모듈 시리얼', editable: true },
      { key: '모듈 스펙', editable: true },
      { key: '업체명', editable: true },
      { key: '연락처', editable: true },
      { key: '업체 주소', editable: true },
      { key: '반출자 이름', editable: true },
      { key: '반출자 서명', editable: false },
      { key: '반납예정일', editable: true },
      { key: '반납일', editable: true },
      { key: '상태', editable: true },
    ],
  },
};
