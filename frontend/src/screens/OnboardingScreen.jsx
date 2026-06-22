import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { parseSpreadsheetId } from '../utils/sheetConfig';

const STEP = { WORKSPACE: 1, SHEETS: 2, TABS: 3 };

// 탭 용도 정의
const TAB_PURPOSES = [
  { key: 'employees',        label: '직원 명단',          required: true,  internalOnly: true  },
  { key: 'serialAssets',     label: '시리얼 물품 목록',    required: true,  internalOnly: false },
  { key: 'serialLog',        label: '시리얼 입출고 이력',  required: true,  internalOnly: false },
  { key: 'consumableMaster', label: '소모품 목록',         required: false, internalOnly: false },
  { key: 'consumableLog',    label: '소모품 입출고 이력',  required: false, internalOnly: false },
];

// 필드별 일반적인 컬럼명 변형 (자동 매핑용)
const FIELD_ALIASES = {
  name:          ['이름', '성명', '직원명', '담당자명'],
  email:         ['이메일', '이메일주소', '이메일 주소', 'Email'],
  title:         ['직함', '직위', '직책'],
  department:    ['소속', '부서', '팀', '부서명'],
  phone:         ['연락처', '전화번호', '핸드폰'],
  itemName:      ['항목', '품목', '품목명', '물품명', '자산명', '제품명'],
  serialNumber:  ['시리얼 넘버', '시리얼번호', 'S/N', 'SN', '일련번호'],
  status:        ['상태', '현황'],
  initialStock:  ['초기 재고수량', '초기재고', '초기수량', '재고수량'],
  totalOut:      ['출고 총갯수', '출고총갯수', '총출고', '출고수량'],
  remaining:     ['현재 잔여갯수', '잔여수량', '잔여갯수', '재고'],
  quantity:      ['출고갯수', '수량', '출고수량'],
  employeeName:  ['출고자', '담당자', '이름', '사용자'],
  checkoutDate:  ['출고일', '대여일', '출고 날짜'],
  returnDueDate: ['반납예정일', '반납 예정일', '반납일정'],
  returnDate:    ['반납일', '반납 날짜', '반납완료일'],
};

function autoSuggest(headers, fieldSchema) {
  const result = {};
  for (const field of fieldSchema) {
    const aliases = FIELD_ALIASES[field.key] || [];
    const match = headers.find((h) =>
      aliases.some((a) => a === h || h.includes(a) || a.includes(h))
    );
    if (match) result[field.key] = match;
  }
  return result;
}

const OPERATION_TYPES = [
  { value: 'internal', label: '내부 직원 전용', desc: '임직원만 사용하는 자산·소모품 관리' },
  { value: 'external', label: '외부인 혼용',   desc: '고객·협력사 등 외부인이 물품을 대여하는 경우' },
];

// ─── 진행 표시기 ────────────────────────────────────────────

function StepProgress({ current, total }) {
  return (
    <div className="ob-progress">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="ob-progress-item">
          <span className={`ob-progress-dot ${i < current ? 'active' : ''}`} />
          {i < total - 1 && <span className="ob-progress-line" />}
        </span>
      ))}
    </div>
  );
}

// ─── Step 1: 작업 공간 이름 + 운영 유형 ─────────────────────

function WorkspaceInfoStep({ onNext }) {
  const [name, setName] = useState('');
  const [operationType, setOperationType] = useState('internal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleNext = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('작업 공간 이름을 입력해 주세요.'); return; }
    setLoading(true); setError(null);
    try {
      const workspace = await api.createWorkspace({ name: trimmed, operationType });
      onNext(workspace);
    } catch (e) {
      setError(e.message || '저장에 실패했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <div className="ob-step">
      <p className="setup-desc" style={{ textAlign: 'left' }}>
        첫 번째 작업 공간을 만들어 보세요. 이름과 운영 유형은 나중에 변경할 수 있습니다.
      </p>

      <div className="form-group">
        <label>작업 공간 이름</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="예: 자재 반출 관리, IT 장비 대여"
          maxLength={50}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
        />
      </div>

      <div className="form-group">
        <label>운영 유형</label>
        <div className="ob-type-options">
          {OPERATION_TYPES.map((opt) => (
            <button key={opt.value} type="button"
              className={`ob-type-btn ${operationType === opt.value ? 'active' : ''}`}
              onClick={() => setOperationType(opt.value)}
            >
              <span className="ob-type-radio">{operationType === opt.value ? '●' : '○'}</span>
              <span className="ob-type-text">
                <span className="ob-type-name">{opt.label}</span>
                <span className="ob-type-desc">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="status-msg error">{error}</div>}
      <button type="button" className="btn btn-primary" onClick={handleNext}
        disabled={loading || !name.trim()} style={{ marginTop: 8 }}>
        {loading ? '저장 중...' : '다음 →'}
      </button>
    </div>
  );
}

// ─── Step 2: 구글 시트 URL 입력 ──────────────────────────────

function SheetSetupStep({ workspace, onNext, onBack }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const spreadsheetId = parseSpreadsheetId(url);

  const handleConnect = async () => {
    if (!spreadsheetId) { setError('올바른 스프레드시트 URL 또는 ID를 입력해 주세요.'); return; }
    setLoading(true); setError(null);
    try {
      const [, { tabs }] = await Promise.all([
        api.saveWorkspaceSheets(workspace.id, {
          main: { spreadsheetId, url },
        }),
        api.getSheetTabs(spreadsheetId),
      ]);
      onNext({ spreadsheetId, tabs });
    } catch (e) {
      setError(e.message || '연결 실패. 서비스 계정 공유 권한을 확인해 주세요.');
    } finally { setLoading(false); }
  };

  return (
    <div className="ob-step">
      <p className="setup-desc" style={{ textAlign: 'left' }}>
        구글 스프레드시트 URL을 붙여넣으면 탭 목록을 자동으로 불러옵니다.
      </p>

      <div className="form-group">
        <label>스프레드시트 URL <span className="ob-required-mark">필수</span></label>
        <input type="url" value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        {spreadsheetId && <span className="parsed-id">ID: {spreadsheetId}</span>}
      </div>

      {error && <div className="status-msg error">{error}</div>}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onBack}
          disabled={loading} style={{ marginBottom: 10 }}>
          ← 이전
        </button>
        <button type="button" className="btn btn-primary" onClick={handleConnect}
          disabled={loading || !spreadsheetId}>
          {loading ? '연결 중...' : '연결하기 →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: 탭 용도 지정 + 컬럼 매핑 ──────────────────────

function ColumnMappingRow({ field, headers, value, onChange }) {
  return (
    <div className="col-map-row">
      <span className="col-map-label">
        {field.label}
        {field.required ? <span className="ob-required-mark">필수</span>
                        : <span className="ob-optional-mark">선택</span>}
        {field.hint && <span className="col-map-hint"> · {field.hint}</span>}
      </span>
      <select className="col-map-select" value={value || ''}
        onChange={(e) => onChange(field.key, e.target.value || null)}>
        <option value="">{field.required ? '선택하세요' : '(없음)'}</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

function TabMappingStep({ workspace, spreadsheetId, availableTabs, onComplete, onBack }) {
  const isInternal = workspace.operationType === 'internal';
  const purposes = TAB_PURPOSES.filter((p) => !p.internalOnly || isInternal);

  const [tabMap, setTabMap] = useState({});          // purpose → tabName
  const [tabHeaders, setTabHeaders] = useState({});  // tabName → string[]
  const [colMap, setColMap] = useState({});          // purpose → { fieldKey → colName }
  const [fieldSchema, setFieldSchema] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // 필드 스키마 로드
  useEffect(() => {
    api.getFieldSchema().then(setFieldSchema).catch(() => {});
  }, []);

  // 탭 선택 시 헤더 자동 조회 + 컬럼 자동 매핑
  const handleTabSelect = useCallback(async (purpose, tabName) => {
    setTabMap((prev) => ({ ...prev, [purpose]: tabName || null }));
    if (!tabName) return;

    if (!tabHeaders[tabName]) {
      setLoading(true);
      try {
        const { headers } = await api.getSheetHeaders(spreadsheetId, tabName);
        setTabHeaders((prev) => ({ ...prev, [tabName]: headers }));
        // 자동 매핑 제안
        const schema = fieldSchema[purpose] || [];
        const suggested = autoSuggest(headers, schema);
        setColMap((prev) => ({ ...prev, [purpose]: suggested }));
      } catch (e) {
        setError(`"${tabName}" 탭 헤더를 불러오지 못했습니다: ${e.message}`);
      } finally { setLoading(false); }
    }
  }, [tabHeaders, fieldSchema, spreadsheetId]);

  const handleColChange = (purpose, fieldKey, colName) => {
    setColMap((prev) => ({
      ...prev,
      [purpose]: { ...(prev[purpose] || {}), [fieldKey]: colName },
    }));
  };

  const validate = () => {
    for (const p of purposes) {
      if (p.required && !tabMap[p.key]) {
        return `"${p.label}" 탭을 선택해 주세요.`;
      }
      if (tabMap[p.key] && fieldSchema[p.key]) {
        const requiredFields = fieldSchema[p.key].filter((f) => f.required);
        for (const f of requiredFields) {
          if (!colMap[p.key]?.[f.key]) {
            return `"${p.label}" 탭의 "${f.label}" 컬럼을 지정해 주세요.`;
          }
        }
      }
    }
    return null;
  };

  const handleComplete = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true); setError(null);
    try {
      const tabs = {};
      for (const p of purposes) {
        if (tabMap[p.key]) {
          tabs[p.key] = {
            tabName: tabMap[p.key],
            fields: colMap[p.key] || {},
          };
        }
      }
      await api.saveWorkspaceTabs(workspace.id, tabs);
      await api.completeOnboarding(workspace.id);
      onComplete();
    } catch (e) {
      setError(e.message || '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  return (
    <div className="ob-step">
      <p className="setup-desc" style={{ textAlign: 'left' }}>
        각 용도에 맞는 탭을 선택하고, 컬럼을 매핑하세요. 자동으로 추천합니다.
      </p>

      {purposes.map((p) => {
        const selectedTab = tabMap[p.key];
        const headers = selectedTab ? (tabHeaders[selectedTab] || []) : [];
        const schema = fieldSchema[p.key] || [];

        return (
          <div key={p.key} className="tab-purpose-block">
            <div className="col-map-row">
              <span className="col-map-label">
                {p.label}
                {p.required ? <span className="ob-required-mark">필수</span>
                             : <span className="ob-optional-mark">선택</span>}
              </span>
              <select className="col-map-select" value={selectedTab || ''}
                onChange={(e) => handleTabSelect(p.key, e.target.value || null)}>
                <option value="">{p.required ? '탭 선택' : '(사용 안 함)'}</option>
                {availableTabs.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {selectedTab && schema.length > 0 && (
              <div className="col-map-fields">
                {loading && !tabHeaders[selectedTab] && (
                  <div className="col-map-loading">헤더 불러오는 중...</div>
                )}
                {tabHeaders[selectedTab] && schema.map((field) => (
                  <ColumnMappingRow key={field.key} field={field}
                    headers={tabHeaders[selectedTab]}
                    value={colMap[p.key]?.[field.key] || ''}
                    onChange={(fk, v) => handleColChange(p.key, fk, v)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {error && <div className="status-msg error">{error}</div>}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onBack}
          disabled={saving} style={{ marginBottom: 10 }}>
          ← 이전
        </button>
        <button type="button" className="btn btn-primary" onClick={handleComplete}
          disabled={saving || loading}>
          {saving ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  );
}

// ─── 메인 온보딩 스크린 ─────────────────────────────────────

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(STEP.WORKSPACE);
  const [workspace, setWorkspace] = useState(null);
  const [sheetInfo, setSheetInfo] = useState(null); // { spreadsheetId, tabs }

  const STEP_TITLES = {
    [STEP.WORKSPACE]: '작업 공간 설정',
    [STEP.SHEETS]:    '구글 시트 연결',
    [STEP.TABS]:      '탭 · 컬럼 설정',
  };

  return (
    <div className="setup-screen">
      <div className="setup-card setup-card-wide">
        <div className="setup-app-brand">
          <h1 className="setup-app-name">Talkment</h1>
          <p className="setup-app-tagline">말로하는 관리 프로그램</p>
        </div>

        <StepProgress current={step} total={3} />
        <p className="ob-step-label">{step} / 3단계</p>
        <h2 className="setup-page-title">{STEP_TITLES[step]}</h2>

        {step === STEP.WORKSPACE && (
          <WorkspaceInfoStep
            onNext={(ws) => { setWorkspace(ws); setStep(STEP.SHEETS); }}
          />
        )}

        {step === STEP.SHEETS && (
          <SheetSetupStep
            workspace={workspace}
            onNext={(info) => { setSheetInfo(info); setStep(STEP.TABS); }}
            onBack={() => setStep(STEP.WORKSPACE)}
          />
        )}

        {step === STEP.TABS && (
          <TabMappingStep
            workspace={workspace}
            spreadsheetId={sheetInfo.spreadsheetId}
            availableTabs={sheetInfo.tabs}
            onComplete={onComplete}
            onBack={() => setStep(STEP.SHEETS)}
          />
        )}
      </div>
    </div>
  );
}
