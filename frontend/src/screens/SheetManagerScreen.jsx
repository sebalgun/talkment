import { useState } from 'react';
import { api } from '../api/client';
import { parseSpreadsheetId } from '../utils/sheetConfig';
import { REQUIRED_SHEET_TABS, SHEET_TAB_COPY_LIST } from '../constants/sheets';
import { useSheet } from '../context/SheetContext';
import { INVENTORY_MODES } from '../constants/inventoryModes';
import DriveSetupSection from '../components/DriveSetupSection';

function SheetRegisterForm({ existingSheet, onRegistered }) {
  const { registerSheetForMode, deleteSheetForMode } = useSheet();
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState(existingSheet?.alias || '');
  const [loading, setLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [error, setError] = useState(null);

  const parsedId = parseSpreadsheetId(url);

  const handleVerify = async () => {
    setError(null);
    setVerifyResult(null);
    const spreadsheetId = parseSpreadsheetId(url);
    if (!spreadsheetId) {
      setError('올바른 구글 스프레드시트 URL 또는 ID를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.verifySheet(spreadsheetId);
      setVerifyResult(result);
      if (!result.ok) {
        setError(`필수 탭 누락: ${result.missingTabs.join(', ')}`);
      } else if (!alias.trim()) {
        setAlias(result.title);
      }
    } catch (e) {
      setError(e.message || '연결 실패. 서비스 계정 공유 권한을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!verifyResult?.ok) return;
    setLoading(true);
    setError(null);
    try {
      await registerSheetForMode(INVENTORY_MODES.INTERNAL, {
        spreadsheetId: verifyResult.spreadsheetId,
        url,
        title: verifyResult.title,
        alias: alias.trim() || verifyResult.title,
      });
      setUrl('');
      setVerifyResult(null);
      onRegistered?.();
    } catch (e) {
      setError(e.message || '등록 저장에 실패했습니다. 서버를 재시작한 뒤 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (!existingSheet) return;
    if (!confirm(`"${existingSheet.alias}" 등록을 삭제하시겠습니까?`)) return;
    deleteSheetForMode(INVENTORY_MODES.INTERNAL);
    setAlias('');
    onRegistered?.();
  };

  if (existingSheet) {
    return (
      <section className="card mode-sheet-card registered">
        <div className="mode-sheet-card-header">
          <h3>사내 스프레드시트</h3>
          <span className="badge badge-ok">등록됨</span>
        </div>
        <div className="sheet-list-title">
          <strong>{existingSheet.alias}</strong>
        </div>
        <div className="data-card-meta">{existingSheet.title}</div>
        <div className="parsed-id">{existingSheet.spreadsheetId}</div>
        <div className="btn-row">
          <button type="button" className="btn btn-outline btn-sm btn-danger-text" onClick={handleRemove}>
            등록 삭제
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card mode-sheet-card">
      <p className="setup-desc">
        사내 임직원 자산·소모품 관리용 스프레드시트를 연결합니다.
      </p>

      <div className="form-group">
        <label>관리 이름 (별칭)</label>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="예: 사내 IT 자산"
        />
      </div>

      <div className="form-group">
        <label>구글 스프레드시트 URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setVerifyResult(null);
            setError(null);
          }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        {parsedId && <span className="parsed-id">ID: {parsedId}</span>}
      </div>

      <div className="setup-checklist">
        <h3>
          필수 탭 ({REQUIRED_SHEET_TABS.length}개) — 탭 이름을 아래와 <strong>완전히 동일</strong>하게
        </h3>
        <pre className="tab-copy-box">{SHEET_TAB_COPY_LIST}</pre>
        <ul>
          {REQUIRED_SHEET_TABS.map((tab) => {
            const found = verifyResult?.tabs?.includes(tab);
            return (
              <li key={tab} className={verifyResult ? (found ? 'ok' : 'missing') : ''}>
                {verifyResult ? (found ? '✓' : '✗') : '·'} {tab}
              </li>
            );
          })}
        </ul>
      </div>

      {verifyResult?.ok && (
        <div className="status-msg success">
          연결 성공: <strong>{verifyResult.title}</strong>
        </div>
      )}
      {error && <div className="status-msg error">{error}</div>}

      <div className="btn-row">
        <button type="button" className="btn btn-outline" onClick={handleVerify} disabled={loading || !url.trim()}>
          {loading ? '확인 중...' : '연결 테스트'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleRegister} disabled={loading || !verifyResult?.ok}>
          {loading ? '저장 중...' : '등록'}
        </button>
      </div>
    </section>
  );
}

const SETUP_TABS = [
  { id: 'sheet', label: '사내 시트' },
  { id: 'signature', label: '서명 (선택)' },
];

export default function SheetManagerScreen({ onComplete, mode = 'initial' }) {
  const { hasSheets, internalSheet } = useSheet();
  const [activeTab, setActiveTab] = useState('sheet');

  return (
    <div className="setup-screen">
      <div className="setup-card setup-card-wide">
        <div className="setup-app-brand">
          <h1 className="setup-app-name">Talkment</h1>
          <p className="setup-app-tagline">말로하는 관리 프로그램</p>
        </div>

        <h2 className="setup-page-title">{mode === 'initial' ? '스프레드시트 등록' : '시트 관리'}</h2>

        <nav className="setup-tab-bar" role="tablist">
          {SETUP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="setup-tab-panel">
          {activeTab === 'sheet' && (
            <SheetRegisterForm existingSheet={internalSheet} />
          )}
          {activeTab === 'signature' && <DriveSetupSection embedded />}
        </div>

        {mode === 'manage' && hasSheets && (
          <button type="button" className="btn btn-primary" onClick={onComplete} style={{ marginTop: 16 }}>
            완료
          </button>
        )}

        {mode === 'initial' && hasSheets && (
          <button type="button" className="btn btn-primary" onClick={onComplete} style={{ marginTop: 16 }}>
            앱 시작하기
          </button>
        )}

        {!hasSheets && (
          <p className="setup-desc" style={{ marginTop: 12 }}>
            사내 스프레드시트를 등록하면 앱을 시작할 수 있습니다. 서명 연결은 선택 사항입니다.
          </p>
        )}
      </div>
    </div>
  );
}
