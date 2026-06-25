import { useState } from 'react';
import { api } from '../api/client';
import { parseSpreadsheetId } from '../utils/sheetConfig';
import { useSheet } from '../context/SheetContext';
import { INVENTORY_MODES } from '../constants/inventoryModes';
import DriveSetupSection from '../components/DriveSetupSection';

const INVENTORY_TYPE_KEY = 'talkment_inventory_type';

const INVENTORY_TYPES = [
  {
    id: 'serial',
    icon: '🔢',
    label: '시리얼 번호 관리',
    desc: '노트북, 장비 등 개별 자산을 시리얼 번호로 추적합니다.',
  },
  {
    id: 'consumable',
    icon: '📦',
    label: '소모품 수량 관리',
    desc: '소모품, 비품 등의 재고 수량을 관리합니다.',
  },
  {
    id: 'both',
    icon: '🗂️',
    label: '둘 다 사용',
    desc: '시리얼 자산과 소모품을 함께 관리합니다.',
  },
];

function InventoryTypeSelect({ onSelect, saving }) {
  const [selected, setSelected] = useState(null);

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div>
      <h3 className="setup-section-title" style={{ marginBottom: 8 }}>물품 관리 유형 선택</h3>
      <p className="data-card-meta" style={{ marginBottom: 16 }}>
        이 시트에서 어떤 방식으로 재고를 관리하시나요?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INVENTORY_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              border: `2px solid ${selected === t.id ? 'var(--color-primary, #2563eb)' : '#e2e8f0'}`,
              borderRadius: 12,
              background: selected === t.id ? 'var(--color-primary-light, #eff6ff)' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{t.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1e293b' }}>{t.label}</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 20, width: '100%' }}
        disabled={!selected || saving}
        onClick={handleConfirm}
      >
        {saving ? '저장 중...' : '확인 및 시작'}
      </button>
    </div>
  );
}

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
      if (!alias.trim()) setAlias(result.title);
    } catch (e) {
      setError(e.message || '연결 실패. 서비스 계정에 편집자 공유 권한을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!verifyResult?.spreadsheetId) return;
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

      {verifyResult?.spreadsheetId && (
        <div className="status-msg success">
          연결 성공: <strong>{verifyResult.title}</strong>
          {verifyResult.tabs?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: '0.8125rem', opacity: 0.85 }}>
              탭 {verifyResult.tabs.length}개 확인됨 — {verifyResult.tabs.join(', ')}
            </div>
          )}
        </div>
      )}
      {error && <div className="status-msg error">{error}</div>}

      <div className="btn-row">
        <button type="button" className="btn btn-outline" onClick={handleVerify} disabled={loading || !url.trim()}>
          {loading ? '확인 중...' : '연결 테스트'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleRegister} disabled={loading || !verifyResult?.spreadsheetId}>
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
  const [step, setStep] = useState('form'); // 'form' | 'type-select'
  const [savingType, setSavingType] = useState(false);

  const handleRegistered = () => {
    if (mode === 'initial') {
      setStep('type-select');
    }
  };

  const handleTypeSelect = async (inventoryType) => {
    setSavingType(true);
    try {
      localStorage.setItem(INVENTORY_TYPE_KEY, inventoryType);
      try {
        const status = await api.getOnboardingStatus();
        if (status.activeWorkspaceId) {
          await api.updateInventoryType(status.activeWorkspaceId, inventoryType);
        }
      } catch {
        // 워크스페이스 없으면 localStorage만 사용
      }
    } finally {
      setSavingType(false);
    }
    onComplete?.();
  };

  if (step === 'type-select') {
    return (
      <div className="setup-screen">
        <div className="setup-card setup-card-wide">
          <div className="setup-app-brand">
            <h1 className="setup-app-name">Talkment</h1>
            <p className="setup-app-tagline">말로하는 관리 프로그램</p>
          </div>
          <InventoryTypeSelect onSelect={handleTypeSelect} saving={savingType} />
        </div>
      </div>
    );
  }

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
            <SheetRegisterForm existingSheet={internalSheet} onRegistered={handleRegistered} />
          )}
          {activeTab === 'signature' && <DriveSetupSection embedded />}
        </div>

        {mode === 'manage' && hasSheets && (
          <button type="button" className="btn btn-primary" onClick={onComplete} style={{ marginTop: 16 }}>
            완료
          </button>
        )}

        {mode === 'initial' && hasSheets && step === 'form' && (
          <button type="button" className="btn btn-primary" onClick={() => setStep('type-select')} style={{ marginTop: 16 }}>
            다음 — 관리 유형 선택
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
