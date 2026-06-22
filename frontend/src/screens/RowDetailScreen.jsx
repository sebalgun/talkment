import { useMemo, useState } from 'react';
import { useApp, getSheetTabsForMode } from '../context/AppContext';
import { ALL_TAB_CONFIG } from '../constants/sheetColumns';
import { api } from '../api/client';

function getDisplayValue(row, key) {
  if (row[key] !== undefined && row[key] !== '') return row[key];
  if (key === '이메일주소') return row['이메일 주소'] ?? row['이메일'] ?? '';
  if (key === '이메일') return row['이메일주소'] ?? row['이메일 주소'] ?? '';
  if (key === '출고 총갯수') return row['츌고 총갯수'] ?? '';
  if (key === '출고서명') return row['출고 서명'] ?? '';
  if (key === '반납서명') return row['반납 서명'] ?? '';
  return '';
}

function isSignatureField(key, value) {
  const signatureKeys = ['출고서명', '반납서명', '서명', '사진'];
  return signatureKeys.includes(key) && String(value).startsWith('=');
}

export default function RowDetailScreen() {
  const { state, dispatch, goDashboard } = useApp();
  const { selectedRow, selectedTab } = state;
  const tabConfig = ALL_TAB_CONFIG[selectedTab];
  const tabLabel = getSheetTabsForMode().find((t) => t.id === selectedTab)?.label;

  const initialFields = useMemo(() => {
    if (!tabConfig || !selectedRow) return {};
    const fields = {};
    tabConfig.columns.forEach((col) => {
      if (col.editable) fields[col.key] = getDisplayValue(selectedRow, col.key);
    });
    return fields;
  }, [tabConfig, selectedRow]);

  const [fields, setFields] = useState(initialFields);
  const [saving, setSaving] = useState(false);

  if (!selectedRow || !tabConfig) {
    return (
      <div className="screen">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <div className="empty">표시할 데이터가 없습니다.</div>
      </div>
    );
  }

  const updateField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const computedRemaining =
    selectedTab === 'consumableMaster'
      ? (parseInt(fields['초기 재고수량'], 10) || 0) - (parseInt(fields['출고 총갯수'], 10) || 0)
      : null;

  const handleSave = async () => {
    setSaving(true);
    dispatch({ type: 'SET_STATUS', payload: null });
    try {
      await api.updateSheetRow({
        tab: selectedTab,
        rowIndex: selectedRow._rowIndex,
        fields,
      });
      goDashboard({ type: 'success', msg: '시트에 저장되었습니다.' });
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen screen-detail">
      <header className="screen-header">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <h2>{tabLabel} 상세</h2>
      </header>

      <section className="card">
        <div className="detail-meta">행 {selectedRow._rowIndex} · {tabConfig.label}</div>
        {tabConfig.columns.map((col) => {
          const value = col.editable ? fields[col.key] ?? '' : getDisplayValue(selectedRow, col.key);
          const signature = isSignatureField(col.key, value);

          return (
            <div className="form-group" key={col.key}>
              <label>
                {col.key}
                {col.computed && <span className="field-tag">자동계산</span>}
                {!col.editable && !col.computed && col.key !== 'No' && (
                  <span className="field-tag">읽기전용</span>
                )}
              </label>
              {col.editable ? (
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) =>
                    updateField(
                      col.key,
                      col.type === 'number' ? e.target.value : e.target.value
                    )
                  }
                />
              ) : col.computed && selectedTab === 'consumableMaster' ? (
                <input value={computedRemaining ?? getDisplayValue(selectedRow, col.key)} readOnly className="readonly" />
              ) : signature ? (
                <div className="signature-preview">서명 이미지 (시트에 저장됨)</div>
              ) : (
                <input value={value || '-'} readOnly className="readonly" />
              )}
            </div>
          );
        })}
      </section>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? '저장 중...' : '시트에 저장'}
      </button>

      {state.status && <div className={`status-msg ${state.status.type}`}>{state.status.msg}</div>}
    </div>
  );
}
