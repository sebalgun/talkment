import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSheet } from '../context/SheetContext';
import { api } from '../api/client';

function ConfigExportSection() {
  const [status, setStatus] = useState(null); // null | 'loading' | { data } | 'error'
  const [copied, setCopied] = useState(null);

  const handleExport = async () => {
    setStatus('loading');
    try {
      const data = await api.exportConfig();
      setStatus(data);
    } catch {
      setStatus('error');
    }
  };

  const copyToClipboard = (key, value) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="card">
      <h3>재배포 후 설정 유지</h3>
      <div className="data-card-meta" style={{ marginBottom: 12 }}>
        아래 값을 Replit Secrets에 등록하면 재배포해도 설정이 유지됩니다.
      </div>

      {!status && (
        <button className="btn btn-outline" onClick={handleExport}>
          설정 내보내기
        </button>
      )}

      {status === 'loading' && (
        <div className="empty-hint">내보내는 중...</div>
      )}

      {status === 'error' && (
        <div className="status-msg error">내보내기 실패. 다시 시도해주세요.</div>
      )}

      {status && status !== 'loading' && status !== 'error' && (
        <div>
          {[
            { key: 'TALKMENT_APP_CONFIG', value: status.TALKMENT_APP_CONFIG },
            { key: 'TALKMENT_WORKSPACES', value: status.TALKMENT_WORKSPACES },
          ].map(({ key, value }) => (
            value && (
              <div key={key} style={{ marginBottom: 12 }}>
                <div className="data-card-meta" style={{ marginBottom: 4, fontWeight: 600 }}>
                  {key}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div
                    style={{
                      flex: 1,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: '0.7rem',
                      wordBreak: 'break-all',
                      maxHeight: 60,
                      overflow: 'hidden',
                      color: '#64748b',
                    }}
                  >
                    {value.slice(0, 80)}...
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8125rem' }}
                    onClick={() => copyToClipboard(key, value)}
                  >
                    {copied === key ? '복사됨!' : '복사'}
                  </button>
                </div>
              </div>
            )
          ))}
          <div className="data-card-meta" style={{ marginTop: 8 }}>
            Replit → Secrets → Key에 위 이름, Value에 복사한 값 붙여넣기 → 재배포
          </div>
        </div>
      )}
    </div>
  );
}

const FIELD_TOGGLE_DEF = [
  {
    key: 'requireSignature',
    label: '서명 요구',
    desc: '출고·반납 후 서명 단계를 표시합니다.',
    defaultVal: true,
  },
  {
    key: 'trackReturnDue',
    label: '반납예정일 입력',
    desc: '출고 폼에 반납 예정일 입력란을 표시합니다.',
    defaultVal: true,
  },
];

function FieldOptionsSection({ workspaceId }) {
  const [options, setOptions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getFieldOptions()
      .then(setOptions)
      .catch(() => setOptions({ requireSignature: true, trackReturnDue: true }));
  }, []);

  const handleToggle = async (key) => {
    if (!options) return;
    const next = { ...options, [key]: !options[key] };
    setOptions(next);
    if (!workspaceId) return;

    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.saveFieldOptions(workspaceId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!options) return <div className="empty-hint">불러오는 중...</div>;

  return (
    <div>
      {FIELD_TOGGLE_DEF.map((def) => {
        const value = options[def.key] ?? def.defaultVal;
        return (
          <div key={def.key} className="field-toggle-row">
            <div className="field-toggle-info">
              <span className="field-toggle-label">{def.label}</span>
              <span className="field-toggle-desc">{def.desc}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={value}
              className={`toggle-switch ${value ? 'on' : 'off'}`}
              onClick={() => handleToggle(def.key)}
              disabled={saving}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        );
      })}
      {saved && <div className="status-msg success" style={{ marginTop: 8 }}>저장됨</div>}
      {error && <div className="status-msg error" style={{ marginTop: 8 }}>{error}</div>}
      {!workspaceId && (
        <div className="data-card-meta" style={{ marginTop: 8 }}>
          설정을 저장하려면 작업 공간을 활성화하세요.
        </div>
      )}
    </div>
  );
}

export default function SettingsScreen({ onOpenSheetManager }) {
  const { user, logout } = useAuth();
  const { activeSheet } = useSheet();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

  useEffect(() => {
    api.getOnboardingStatus()
      .then((s) => setActiveWorkspaceId(s.activeWorkspaceId))
      .catch(() => {});
  }, []);

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

      <ConfigExportSection />

      <div className="card">
        <h3>출고 폼 설정</h3>
        <FieldOptionsSection workspaceId={activeWorkspaceId} />
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
