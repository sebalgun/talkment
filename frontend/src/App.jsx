import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppProvider, useApp, SCREENS } from './context/AppContext';
import { SheetProvider, useSheet } from './context/SheetContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardScreen from './screens/DashboardScreen';
import FormScreen from './screens/FormScreen';
import ReturnListScreen from './screens/ReturnListScreen';
import SummaryDetailScreen from './screens/SummaryDetailScreen';
import RowDetailScreen from './screens/RowDetailScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import WorkspaceSelectScreen from './screens/WorkspaceSelectScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { LoginScreen } from './screens/LoginScreen';
import SignatureModal from './components/SignatureModal';
import MicButton from './components/MicButton';
import BottomTabBar from './components/BottomTabBar';
import { getSheetTabsForMode } from './context/AppContext';
import { api } from './api/client';

function SplashLoader({ text = '로딩 중...' }) {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-app-brand">
          <h1 className="setup-app-name">Talkment</h1>
          <p className="setup-app-tagline">말로하는 관리 프로그램</p>
        </div>
        <p className="setup-desc">{text}</p>
      </div>
    </div>
  );
}

function SheetLink({ onManage }) {
  const { activeSheet } = useSheet();
  if (!activeSheet) return null;
  return (
    <button type="button" className="mode-sheet-link" onClick={onManage} title="시트 관리">
      📂 {activeSheet.alias}
    </button>
  );
}

// ── 대시보드 쉘 (워크스페이스 선택 후) ──────────────────────────
function AppRouter({ onBack, onOpenSheetManager }) {
  const { state, dispatch } = useApp();
  const { activeSheet, version } = useSheet();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState('dashboard');

  const handleRefresh = () => {
    dispatch({ type: 'REFRESH' });
    dispatch({ type: 'SET_STATUS', payload: { type: 'info', msg: '데이터를 새로 불러왔습니다.' } });
  };

  const badgeLabel = mainTab === 'history' ? '반출이력'
    : mainTab === 'settings' ? '설정'
    : state.screen === SCREENS.DASHBOARD ? '재고현황'
    : state.screen === SCREENS.FORM ? '출고 검증'
    : state.screen === SCREENS.RETURN_LIST ? '미반납 목록'
    : state.screen === SCREENS.SUMMARY_DETAIL ? '현황 상세'
    : state.screen === SCREENS.ROW_DETAIL ? '상세 · 수정'
    : '';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <button className="header-back-btn" onClick={onBack} title="프로젝트 목록">
            ←
          </button>
          <div className="header-brand">
            <h1>{activeSheet?.alias || 'Talkment'}</h1>
            {mainTab === 'dashboard' && <SheetLink onManage={onOpenSheetManager} />}
          </div>
        </div>
        <div className="header-right">
          <span className="screen-badge">{badgeLabel}</span>
          {mainTab === 'dashboard' && (
            <button className="header-icon-btn" onClick={handleRefresh} title="새로고침">
              ↻
            </button>
          )}
        </div>
      </header>

      <main className="app-main" key={`${activeSheet?.id}-${version}`}>
        {mainTab === 'dashboard' && (
          <>
            {state.screen === SCREENS.DASHBOARD && <DashboardScreen />}
            {state.screen === SCREENS.FORM && <FormScreen />}
            {state.screen === SCREENS.RETURN_LIST && <ReturnListScreen />}
            {state.screen === SCREENS.SUMMARY_DETAIL && <SummaryDetailScreen />}
            {state.screen === SCREENS.ROW_DETAIL && (
              <RowDetailScreen key={`${state.selectedTab}-${state.selectedRow?._rowIndex}`} />
            )}
          </>
        )}
        {mainTab === 'history' && <HistoryScreen />}
        {mainTab === 'settings' && (
          <SettingsScreen
            onOpenSheetManager={onOpenSheetManager}
            onBackToProjects={onBack}
          />
        )}
      </main>

      {mainTab === 'dashboard' && <MicButton />}
      <SignatureModal />
      <BottomTabBar activeTab={mainTab} onTabChange={setMainTab} />
    </div>
  );
}

// ── 앱 콘텐츠 — 진입 플로우 관리 ─────────────────────────────────
function AppContent() {
  const { isLoggedIn, checked: authChecked } = useAuth();
  const { registerSheetForMode, bootstrapped } = useSheet();

  // 'workspace-select' | 'add-project' | 'dashboard'
  const [view, setView] = useState('workspace-select');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [showSheetManager, setShowSheetManager] = useState(false);
  const defaultTab = getSheetTabsForMode()[0]?.id || 'assets';

  // 로그아웃 시 초기화
  useEffect(() => {
    if (!isLoggedIn) {
      setView('workspace-select');
      setSelectedWorkspaceId(null);
    }
  }, [isLoggedIn]);

  const handleWorkspaceSelect = async (workspaceId) => {
    setSelectedWorkspaceId(workspaceId);
    // SheetContext 동기화 — 서버에서 갱신된 app-config 읽기
    try {
      const cfg = await api.getAppConfig();
      if (cfg.sheet?.spreadsheetId) {
        await registerSheetForMode(null, cfg.sheet);
      }
    } catch { /* SheetContext refresh가 처리 */ }
    setView('dashboard');
  };

  const handleOnboardingComplete = async () => {
    try {
      const cfg = await api.getAppConfig();
      if (cfg.sheet?.spreadsheetId) {
        await registerSheetForMode(null, cfg.sheet);
      }
    } catch { /* ignore */ }
    setView('workspace-select');
  };

  // ── 로딩 / 미로그인 ──
  if (!authChecked) return <SplashLoader text="인증 확인 중..." />;
  if (!isLoggedIn) return <LoginScreen />;
  if (!bootstrapped) return <SplashLoader text="설정 불러오는 중..." />;

  // ── 새 프로젝트 온보딩 ──
  if (view === 'add-project') {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        onCancel={() => setView('workspace-select')}
      />
    );
  }

  // ── 프로젝트 대시보드 ──
  if (view === 'dashboard' && selectedWorkspaceId) {
    return (
      <AppProvider key={selectedWorkspaceId} initialSheetTab={defaultTab}>
        <AppRouter
          onBack={() => setView('workspace-select')}
          onOpenSheetManager={() => setShowSheetManager(true)}
        />
      </AppProvider>
    );
  }

  // ── 워크스페이스 선택 (기본 첫 화면) ──
  return (
    <WorkspaceSelectScreen
      onSelect={handleWorkspaceSelect}
      onAddNew={() => setView('add-project')}
    />
  );
}

export default function App() {
  const [googleClientId, setGoogleClientId] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    api.getPublicConfig()
      .then((cfg) => {
        setGoogleClientId(cfg.googleClientId || '');
        setConfigLoaded(true);
      })
      .catch(() => {
        setGoogleClientId('');
        setConfigLoaded(true);
      });
  }, []);

  if (!configLoaded) return <SplashLoader />;

  return (
    <GoogleOAuthProvider clientId={googleClientId || 'UNCONFIGURED'}>
      <AuthProvider>
        <SheetProvider>
          <AppContent />
        </SheetProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
