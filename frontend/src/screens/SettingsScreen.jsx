import { useAuth } from '../context/AuthContext';
import { useSheet } from '../context/SheetContext';

export default function SettingsScreen({ onOpenSheetManager }) {
  const { user, logout } = useAuth();
  const { activeSheet } = useSheet();

  return (
    <div className="screen-settings">
      {user && (
        <div className="card">
          <h3>계정</h3>
          <div className="settings-user">
            <span className="settings-user-name">{user.name || user.email}</span>
            {user.name && user.email && (
              <span className="settings-user-email">{user.email}</span>
            )}
          </div>
          <button
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      )}

      <div className="card">
        <h3>프로젝트</h3>
        {activeSheet ? (
          <div>
            <div className="settings-user-name">{activeSheet.alias}</div>
            <div className="data-card-meta" style={{ marginTop: 4 }}>
              {activeSheet.spreadsheetId?.slice(0, 20)}...
            </div>
          </div>
        ) : (
          <div className="empty-hint">등록된 시트 없음</div>
        )}
        <button
          className="btn btn-outline"
          style={{ marginTop: 12 }}
          onClick={onOpenSheetManager}
        >
          시트 관리
        </button>
      </div>

      <div className="card">
        <h3>앱 정보</h3>
        <div className="data-card-meta">Talkment — 말로하는 관리 프로그램</div>
        <div className="data-card-meta" style={{ marginTop: 4 }}>
          v1.0 · Google Sheets 연동
        </div>
      </div>
    </div>
  );
}
