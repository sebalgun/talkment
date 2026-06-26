import { createContext, useContext, useReducer, useCallback } from 'react';

export const SCREENS = {
  DASHBOARD: 'dashboard',
  FORM: 'form',
  RETURN_LIST: 'returnList',
  SUMMARY_DETAIL: 'summaryDetail',
  ROW_DETAIL: 'rowDetail',
};

export const INTERNAL_SHEET_TABS = [
  { id: 'assets', label: '시리얼 물품', api: 'assets' },
  { id: 'serialLog', label: '시리얼 입출고 내역', api: 'serialLog' },
  { id: 'consumableMaster', label: '일반 물품', api: 'consumableMaster' },
  { id: 'consumableLog', label: '입출고 내역', api: 'consumableLog' },
  { id: 'employees', label: '명단', api: 'employees' },
  { id: 'inventoryMaster', label: '물품관리', api: 'inventoryMaster' },
];

export function getSheetTabsForMode() {
  return INTERNAL_SHEET_TABS;
}

/** @deprecated INTERNAL_SHEET_TABS 사용 */
export const SHEET_TABS = INTERNAL_SHEET_TABS;

const initialState = {
  screen: SCREENS.DASHBOARD,
  sheetTab: 'assets',

  transcript: '',
  parseResult: null,
  form: null,
  employee: null,
  employeeMatches: [],
  showDuplicateModal: false,

  returnQuery: '',
  returnItems: [],

  summaryDetailType: null,

  signatureModal: null,
  selectedRow: null,
  selectedTab: null,
  status: null,
  loading: false,
  refreshKey: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_SHEET_TAB':
      return { ...state, sheetTab: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'GO_DASHBOARD':
      return {
        ...initialState,
        refreshKey: state.refreshKey + 1,
        sheetTab: action.payload?.sheetTab ?? state.sheetTab,
        status: action.payload?.status ?? null,
      };
    case 'GO_FORM':
      return {
        ...state,
        screen: SCREENS.FORM,
        transcript: action.payload.transcript,
        parseResult: action.payload.parseResult,
        form: action.payload.form,
        employee: action.payload.employee,
        employeeMatches: action.payload.employeeMatches,
        showDuplicateModal: action.payload.showDuplicateModal,
        status: action.payload.status || null,
        loading: false,
      };
    case 'UPDATE_FORM':
      return { ...state, form: { ...state.form, ...action.payload } };
    case 'SET_EMPLOYEE':
      return { ...state, employee: action.payload, showDuplicateModal: false };
    case 'SHOW_DUPLICATE_MODAL':
      return { ...state, showDuplicateModal: true };
    case 'HIDE_DUPLICATE_MODAL':
      return { ...state, showDuplicateModal: false };
    case 'GO_RETURN_LIST':
      return {
        ...state,
        screen: SCREENS.RETURN_LIST,
        returnQuery: action.payload.query,
        returnItems: action.payload.items,
        transcript: action.payload.transcript || state.transcript,
        status: action.payload.status || null,
        loading: false,
      };
    case 'GO_SUMMARY_DETAIL':
      return {
        ...state,
        screen: SCREENS.SUMMARY_DETAIL,
        summaryDetailType: action.payload.type,
        status: null,
      };
    case 'GO_ROW_DETAIL':
      return {
        ...state,
        screen: SCREENS.ROW_DETAIL,
        selectedRow: action.payload.row,
        selectedTab: action.payload.tab,
        status: null,
      };
    case 'OPEN_SIGNATURE':
      return { ...state, signatureModal: action.payload };
    case 'CLOSE_SIGNATURE':
      return { ...state, signatureModal: null };
    case 'REFRESH':
      return { ...state, refreshKey: state.refreshKey + 1 };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children, initialSheetTab = 'assets' }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, sheetTab: initialSheetTab });

  const goDashboard = useCallback(
    (status) => dispatch({ type: 'GO_DASHBOARD', payload: { status } }),
    []
  );

  return (
    <AppContext.Provider value={{ state, dispatch, goDashboard }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
