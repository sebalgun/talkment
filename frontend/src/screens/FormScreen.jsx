import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import DuplicateNameModal from '../components/DuplicateNameModal';
import { api } from '../api/client';
import { todayISO } from '../utils/date';
import { getCheckoutValidationErrors } from '../utils/checkoutValidation';

const BASE_FORM_FIELDS = [
  { key: 'itemName', label: '품목', type: 'select' },
  { key: 'quantity', label: '수량', type: 'number', show: (f) => f.itemType === 'serial' || f.itemType === 'consumable' },
  { key: 'checkoutDate', label: '출고일', type: 'date', readonly: true },
  { key: 'returnDueDate', label: '반납 예정일', type: 'date', optional: true },
];

function uniqueItemOptions(rows, nameKey = '항목') {
  const seen = new Set();
  return rows
    .filter((r) => r[nameKey] && !seen.has(r[nameKey]) && seen.add(r[nameKey]))
    .map((r) => ({
      value: r[nameKey],
      label:
        r['현재 잔여갯수'] !== undefined
          ? `${r[nameKey]} (잔여 ${r['현재 잔여갯수']}개)`
          : r[nameKey],
    }));
}

function serialOptionsForItem(rows, itemName) {
  if (!itemName) return [];
  return rows
    .filter((r) => r['항목'] === itemName && r['시리얼 넘버'])
    .filter((r) => {
      const status = String(r['상태'] || '').trim();
      return status !== '반출' && status !== '대여중';
    })
    .map((r) => ({ value: r['시리얼 넘버'], label: r['시리얼 넘버'] }));
}

function withExtraOption(options, value) {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: value }, ...options];
}

export default function FormScreen() {
  const { state, dispatch, goDashboard } = useApp();
  const { form, employee, employeeMatches, transcript, loading } = state;

  const isManualMode = !transcript;

  const [assetsRows, setAssetsRows] = useState([]);
  const [consumableMaster, setConsumableMaster] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [fieldOptions, setFieldOptions] = useState({ requireSignature: true, trackReturnDue: true });
  const [employeeList, setEmployeeList] = useState([]);
  const [empQuery, setEmpQuery] = useState('');
  const [empDropOpen, setEmpDropOpen] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    api.getFieldOptions().then(setFieldOptions).catch(() => {});
  }, []);

  // 직접 입력 모드 — 직원 목록 미리 로드
  useEffect(() => {
    if (isManualMode) {
      api.getEmployees().then(setEmployeeList).catch(() => {});
    }
  }, [isManualMode]);

  const FORM_FIELDS = useMemo(() => {
    return BASE_FORM_FIELDS.filter((f) => {
      if (f.key === 'returnDueDate' && !fieldOptions.trackReturnDue) return false;
      return true;
    });
  }, [fieldOptions.trackReturnDue]);

  const quantity = Math.max(1, parseInt(form?.quantity, 10) || 1);
  const selectedSerials = form?.serialNumbers || [];

  useEffect(() => {
    if (!form) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingItems(true);
      try {
        if (form.itemType === 'consumable') {
          const master = await api.getConsumableMaster();
          if (!cancelled) setConsumableMaster(master);
        } else {
          const assets = await api.getAssets();
          if (!cancelled) setAssetsRows(assets);
        }
      } catch (e) {
        if (!cancelled) dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form?.itemType, dispatch]);

  useEffect(() => {
    if (!form || form.checkoutDate) return;
    dispatch({ type: 'UPDATE_FORM', payload: { checkoutDate: todayISO() } });
  }, [form, dispatch]);

  const itemOptions = useMemo(() => {
    const base =
      form?.itemType === 'consumable'
        ? uniqueItemOptions(consumableMaster)
        : uniqueItemOptions(assetsRows);
    return withExtraOption(base, form?.itemName);
  }, [form?.itemType, form?.itemName, assetsRows, consumableMaster]);

  const availableSerialOptions = useMemo(
    () => serialOptionsForItem(assetsRows, form?.itemName),
    [assetsRows, form?.itemName]
  );
  const availableSerialCount = availableSerialOptions.length;

  const serialSlots = useMemo(() => {
    const slots = [...selectedSerials];
    while (slots.length < quantity) slots.push('');
    return slots.slice(0, quantity);
  }, [selectedSerials, quantity]);

  const optionsForSerialSlot = (slotIndex) => {
    const taken = serialSlots.filter((sn, i) => i !== slotIndex && sn);
    return availableSerialOptions.filter((o) => !taken.includes(o.value));
  };

  const knownItemNames = useMemo(() => {
    const rows = form?.itemType === 'consumable' ? consumableMaster : assetsRows;
    return uniqueItemOptions(rows).map((o) => o.value);
  }, [form?.itemType, consumableMaster, assetsRows]);

  const consumableRemaining = useMemo(() => {
    if (form?.itemType !== 'consumable' || !form?.itemName) return null;
    const row = consumableMaster.find((r) => r['항목'] === form.itemName);
    if (!row) return null;
    return parseInt(row['현재 잔여갯수'], 10) || 0;
  }, [form?.itemType, form?.itemName, consumableMaster]);

  // 직원 검색 필터 (직접 입력 모드)
  const filteredEmps = useMemo(() => {
    if (!isManualMode || !empQuery.trim()) return [];
    const q = empQuery.trim();
    return employeeList
      .filter((e) => e['이름']?.includes(q) || e['소속']?.includes(q))
      .slice(0, 8);
  }, [isManualMode, empQuery, employeeList]);

  const validationErrors = useMemo(
    () =>
      getCheckoutValidationErrors({
        form,
        employee,
        employeeMatches,
        loadingItems,
        quantity,
        selectedSerials: serialSlots,
        knownItemNames,
        availableSerialCount,
        consumableRemaining,
      }),
    [form, employee, employeeMatches, loadingItems, quantity, serialSlots, knownItemNames, availableSerialCount, consumableRemaining]
  );

  // 직접 입력 모드: 명단에 없어도 이름만 있으면 진행 허용
  const hasEmployee = Boolean(employee || (isManualMode && form?.employeeName?.trim()));
  const blockingErrors = isManualMode
    ? validationErrors.filter(
        (e) =>
          !e.includes('명단에서 찾을 수 없습니다') &&
          !e.includes('이름을 확인할 수 없습니다')
      )
    : validationErrors;

  const canConfirm = !loading && blockingErrors.length === 0 && hasEmployee && !!form?.itemName;

  const updateField = (key, value) => dispatch({ type: 'UPDATE_FORM', payload: { [key]: value } });

  const handleItemChange = (itemName) => {
    dispatch({ type: 'UPDATE_FORM', payload: { itemName, serialNumbers: [] } });
  };

  const handleQuantityChange = (value) => {
    const nextQty = Math.max(1, parseInt(value, 10) || 1);
    const serialNumbers = serialSlots.slice(0, nextQty);
    while (serialNumbers.length < nextQty) serialNumbers.push('');
    dispatch({ type: 'UPDATE_FORM', payload: { quantity: nextQty, serialNumbers } });
  };

  const handleSerialSelect = (slotIndex, value) => {
    const next = [...serialSlots];
    next[slotIndex] = value;
    dispatch({ type: 'UPDATE_FORM', payload: { serialNumbers: next } });
  };

  const handleEmpSelect = (emp) => {
    dispatch({ type: 'SET_EMPLOYEE', payload: emp });
    dispatch({ type: 'UPDATE_FORM', payload: { employeeName: emp['이름'] } });
    setEmpQuery(emp['이름']);
    setEmpDropOpen(false);
  };

  const handleEmpClear = () => {
    dispatch({ type: 'SET_EMPLOYEE', payload: null });
    dispatch({ type: 'UPDATE_FORM', payload: { employeeName: '' } });
    setEmpQuery('');
    setEmpDropOpen(false);
  };

  const renderFieldInput = (field) => {
    if (field.key === 'itemName') {
      return (
        <select
          value={form?.itemName ?? ''}
          onChange={(e) => handleItemChange(e.target.value)}
          disabled={loadingItems}
        >
          <option value="">{loadingItems ? '품목 불러오는 중...' : '품목 선택'}</option>
          {itemOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type}
        value={form?.[field.key] ?? (field.key === 'checkoutDate' ? todayISO() : field.key === 'quantity' ? quantity : '')}
        readOnly={field.readonly}
        className={field.readonly ? 'readonly' : undefined}
        min={field.type === 'number' ? 1 : undefined}
        onChange={(e) => {
          if (field.key === 'quantity') handleQuantityChange(e.target.value);
          else updateField(field.key, field.type === 'number' ? +e.target.value : e.target.value);
        }}
      />
    );
  };

  const handleConfirm = async () => {
    setHasAttempted(true);
    if (!canConfirm) return;
    if (!form || !hasEmployee) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_STATUS', payload: null });
    try {
      const filledSerials = serialSlots.filter(Boolean);
      const payload = {
        ...form,
        quantity,
        serialNumbers: filledSerials,
        serialNumber: filledSerials[0] || form.serialNumber || '',
      };
      const result = await api.checkout(payload, employee);
      const personName = employee?.['이름'] || form?.employeeName || '';
      const label =
        quantity > 1
          ? `${personName} ${form.itemName} ${quantity}대 출고`
          : `${personName} ${form.itemName} 출고`;

      if (fieldOptions.requireSignature) {
        dispatch({ type: 'OPEN_SIGNATURE', payload: { mode: 'checkout', checkoutResult: result, label } });
      } else {
        goDashboard({ type: 'success', msg: `${label} 완료` });
      }
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="screen screen-form">
      <header className="screen-header">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <h2>{isManualMode ? '직접 입력 (반출)' : '출고 데이터 검증'}</h2>
      </header>

      {/* 음성 원문 — 음성 모드만 표시 */}
      {!isManualMode && (
        <section className="card">
          <h3>음성 인식 원문 (STT)</h3>
          <div className="stt-label">{transcript || '(없음)'}</div>
        </section>
      )}

      <section className="card">
        <h3>{isManualMode ? '반출 정보 입력' : '가공된 입력 폼'}</h3>

        {(hasAttempted || !isManualMode) && blockingErrors.length > 0 && (
          <div className="validation-panel" role="alert">
            <strong>확인 필요</strong>
            <ul>
              {blockingErrors.map((msg) => <li key={msg}>{msg}</li>)}
            </ul>
          </div>
        )}

        {/* 출고자 — 직접 입력 모드: 검색 / 음성 모드: readonly */}
        {isManualMode ? (
          <div className="form-group">
            <label>출고자</label>
            {employee ? (
              <div className="emp-selected-row">
                <div className="emp-selected-info">
                  <strong>{employee['이름']}</strong>
                  <span className="emp-meta">
                    {[employee['소속'], employee['직함']].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleEmpClear}>변경</button>
              </div>
            ) : (
              <div className="emp-search-wrap">
                <input
                  type="text"
                  placeholder="이름 또는 소속으로 검색"
                  value={empQuery}
                  autoFocus
                  autoComplete="off"
                  onChange={(e) => {
                    setEmpQuery(e.target.value);
                    setEmpDropOpen(true);
                    dispatch({ type: 'UPDATE_FORM', payload: { employeeName: e.target.value } });
                  }}
                  onFocus={() => setEmpDropOpen(true)}
                  onBlur={() => setTimeout(() => setEmpDropOpen(false), 150)}
                />
                {empDropOpen && filteredEmps.length > 0 && (
                  <div className="emp-search-drop">
                    {filteredEmps.map((emp) => (
                      <button
                        key={`${emp['이름']}-${emp['소속']}`}
                        className="emp-search-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleEmpSelect(emp)}
                      >
                        <strong>{emp['이름']}</strong>
                        <span className="emp-meta">
                          {[emp['소속'], emp['직함']].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {empDropOpen && empQuery.trim() && filteredEmps.length === 0 && (
                  <div className="emp-search-none">
                    명단에 없음 — 이름 그대로 기록됩니다
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>출고자</label>
              <input value={employee?.['이름'] || form?.employeeName || ''} readOnly className="readonly" />
            </div>
            <div className="form-group">
              <label>소속</label>
              <input value={employee?.['소속'] || form?.department || ''} readOnly className="readonly" />
            </div>
            <div className="form-group">
              <label>직함</label>
              <input value={employee?.['직함'] || form?.title || ''} readOnly className="readonly" />
            </div>
            <div className="form-group">
              <label>연락처</label>
              <input value={employee?.['연락처'] || ''} readOnly className="readonly" />
            </div>
          </>
        )}

        {/* 공통 입력 필드 */}
        {FORM_FIELDS.filter((f) => !f.show || f.show(form)).map((field) => (
          <div className="form-group" key={field.key}>
            <label>{field.label}</label>
            {renderFieldInput(field)}
          </div>
        ))}

        {/* 시리얼 번호 선택 */}
        {form?.itemType === 'serial' && (
          <div className="form-group serial-select-group">
            <label>
              시리얼 번호
              <span className="field-tag">
                {serialSlots.filter(Boolean).length}/{quantity}개 선택
                {!loadingItems && form?.itemName && (
                  <> · 출고 가능 {availableSerialCount}대</>
                )}
              </span>
            </label>
            {!form?.itemName ? (
              <div className="empty-hint">품목을 먼저 선택하세요</div>
            ) : loadingItems ? (
              <div className="empty-hint">시리얼 불러오는 중...</div>
            ) : availableSerialOptions.length === 0 ? (
              <div className="empty-hint">출고 가능한 시리얼이 없습니다</div>
            ) : (
              <div className="serial-select-list">
                {serialSlots.map((selected, index) => (
                  <div className="form-group serial-select-row" key={index}>
                    <label>{quantity > 1 ? `시리얼 ${index + 1}` : '시리얼 번호'}</label>
                    <select
                      value={selected}
                      onChange={(e) => handleSerialSelect(index, e.target.value)}
                    >
                      <option value="">시리얼 선택</option>
                      {optionsForSerialSlot(index).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 임직원 매칭 결과 — 음성 모드만 표시 */}
      {!isManualMode && (
        <section className="card">
          <h3>임직원 매칭 결과</h3>
          {employee ? (
            <div className="match-result match-ok">
              <span className="match-icon">✓</span>
              <div>
                <strong>{employee['이름']}</strong>
                <div className="data-card-meta">
                  {employee['소속']} · {employee['직함']} · {employee['연락처']}
                </div>
              </div>
            </div>
          ) : (
            <div className="match-result match-warn">
              임직원이 선택되지 않았습니다.
              {employeeMatches.length > 1 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => dispatch({ type: 'SHOW_DUPLICATE_MODAL' })}
                >
                  소속 선택
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <button
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={loading || (!isManualMode && !canConfirm)}
      >
        {loading ? '처리 중...' : fieldOptions.requireSignature ? '출고 확정 → 서명' : '출고 확정'}
      </button>

      {state.status && (
        <div className={`status-msg ${state.status.type}`}>{state.status.msg}</div>
      )}

      {state.showDuplicateModal && (
        <DuplicateNameModal
          matches={employeeMatches}
          onSelect={(emp) => dispatch({ type: 'SET_EMPLOYEE', payload: emp })}
          onClose={() => dispatch({ type: 'HIDE_DUPLICATE_MODAL' })}
        />
      )}
    </div>
  );
}
