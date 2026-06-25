import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppProvider, useApp, SCREENS } from './context/AppContext';
import { SheetProvider, useSheet, isSheetConfigured } from './context/SheetContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardScreen from './screens/DashboardScreen';
import FormScreen from './screens/FormScreen';
import ReturnListScreen from './screens/ReturnListScreen';
import SummaryDetailScreen from './screens/SummaryDetailScreen';
import RowDetailScreen from './screens/RowDetailScreen';
import SheetManagerScreen from './screens/SheetManagerScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { LoginScreen } from './screens/LoginScreen';
import SignatureModal from './components/SignatureModal';
import MicButton from './components/MicButton';
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

function AppRouter({ onOpenSheetManager }) {
  const { state, dispatch } = useApp();
  const { activeSheet, version } = useSheet();
  const { user, logout } = useAuth();

  const handleRefresh = () => {
    dispatch({ type: 'REFRESH' });
    dispatch({ type: 'SET_STATUS', payload: { type: 'info', msg: '데이터를 새로 불러왔습니다.' } });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <div className="header-brand">
            <h1>Talkment</h1>
            <span className="header-tagline">말로하는 관리 프로그램</span>
          </div>
          <SheetLink onManage={onOpenSheetManager} />
        </div>
        <div className="header-right">
          <span className="screen-badge">
            {state.screen === SCREENS.DASHBOARD && '대시보드'}
            {state.screen === SCREENS.FORM && '출고 검증'}
            {state.screen === SCREENS.RETURN_LIST && '미반납 목록'}
            {state.screen === SCREENS.SUMMARY_DETAIL && '현황 상세'}
            {state.screen === SCREENS.ROW_DETAIL && '상세 · 수정'}
          </span>
          <button className="header-icon-btn" onClick={handleRefresh} title="새로고침">
            ↻
          </button>
          <button className="header-icon-btn" onClick={onOpenSheetManager} title="시트 관리">
            ⚙
          </button>
          {user && (
            <button
              className="header-icon-btn"
              onClick={logout}
              title={`${user.name || user.email} · 로그아웃`}
              style={{ fontSize: '16px' }}
            >
              👤
            </button>
          )}
        </div>
      </header>

      <main className="app-main" key={`${activeSheet?.id}-${version}`}>
        {state.screen === SCREENS.DASHBOARD && <DashboardScreen />}
        {state.screen === SCREENS.FORM && <FormScreen />}
        {state.screen === SCREENS.RETURN_LIST && <ReturnListScreen />}
        {state.screen === SCREENS.SUMMARY_DETAIL && <SummaryDetailScreen />}
        {state.screen === SCREENS.ROW_DETAIL && (
          <RowDetailScreen key={`${state.selectedTab}-${state.selectedRow?._rowIndex}`} />
        )}
      </main>

      <MicButton />
      <SignatureModal />
    </div>
  );
}

function AppContent() {
  const [showManager, setShowManager] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const { hasSheets, activeSheet, bootstrapped, registerSheetForMode } = useSheet();
  const { isLoggedIn, checked: authChecked } = useAuth();
  const defaultTab = getSheetTabsForMode()[0]?.id || 'assets';

  useEffect(() => {
    if (!isLoggedIn) {
      setShowOnboarding(false);
      setShowManager(false);
      setOnboardingChecked(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    // 로그인 + 시트 컨텍스트 준비 후 온보딩 상태 확인
    if (!authChecked || !isLoggedIn || !bootstrapped) return;

    if (!isSheetConfigured()) {
      api.getOnboardingStatus()
        .then(({ isFirstRun }) => {
          setShowOnboarding(isFirstRun);
          setShowManager(!isFirstRun);
          setOnboardingChecked(true);
        })
        .catch(() => {
          setShowManager(true);
          setOnboardingChecked(true);
        });
    } else {
      setShowOnboarding(false);
      setShowManager(false);
      setOnboardingChecked(true);
    }
  }, [authChecked, isLoggedIn, bootstrapped, hasSheets]);

  const handleOnboardingComplete = async () => {
    try {
      const cfg = await api.getAppConfig();
      if (cfg.sheet?.spreadsheetId) {
        await registerSheetForMode(null, cfg.sheet);
      }
    } catch { /* SheetContext refresh가 처리 */ }
    setShowOnboarding(false);
  };

  // 인증 확인 중
  if (!authChecked) return <SplashLoader text="인증 확인 중..." />;

  // 미로그인
  if (!isLoggedIn) return <LoginScreen />;

  // 앱 설정 로딩 중
  if (!bootstrapped || !onboardingChecked) return <SplashLoader text="설정 불러오는 중..." />;

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (!hasSheets || showManager) {
    return (
      <SheetManagerScreen
        mode={hasSheets ? 'manage' : 'initial'}
        onComplete={() => setShowManager(false)}
      />
    );
  }

  return (
    <AppProvider key={activeSheet?.id} initialSheetTab={defaultTab}>
      <AppRouter onOpenSheetManager={() => setShowManager(true)} />
    </AppProvider>
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
