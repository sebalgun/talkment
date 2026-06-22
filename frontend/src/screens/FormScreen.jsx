import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import DuplicateNameModal from '../components/DuplicateNameModal';
import { api } from '../api/client';
import { todayISO } from '../utils/date';
import { getCheckoutValidationErrors } from '../utils/checkoutValidation';

const FORM_FIELDS = [
  { key: 'itemName', label: '품목', type: 'select' },
  { key: 'quantity', label: '수량', type: 'number', show: (f) => f.itemType === 'serial' || f.itemType === 'consumable' },
  { key: 'checkoutDate', label: '출고일', type: 'date', readonly: true },
  { key: 'returnDueDate', label: '반납 예정일', type: 'date' },
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
    .map((r) => ({ value: r['시리얼 넘버'], label: r['시리얼 넘버'], available: true }));
}

function withExtraOption(options, value) {
  if (!value || options.some((o) => o.value === value)) return options;
  return [{ value, label: value, available: true }, ...options];
}

export default function FormScreen() {
  const { state, dispatch, goDashboard } = useApp();
  const { form, employee, employeeMatches, transcript, loading } = state;
  const [assetsRows, setAssetsRows] = useState([]);
  const [consumableMaster, setConsumableMaster] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

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
        if (!cancelled) {
          dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
        }
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form?.itemType, dispatch]);

  useEffect(() => {
    if (!form || form.checkoutDate) return;
    dispatch({
      type: 'UPDATE_FORM',
      payload: { checkoutDate: todayISO() },
    });
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
    [
      form,
      employee,
      employeeMatches,
      loadingItems,
      quantity,
      serialSlots,
      knownItemNames,
      availableSerialCount,
      consumableRemaining,
    ]
  );

  const updateField = (key, value) => {
    dispatch({ type: 'UPDATE_FORM', payload: { [key]: value } });
  };

  const handleItemChange = (itemName) => {
    dispatch({
      type: 'UPDATE_FORM',
      payload: { itemName, serialNumbers: [] },
    });
  };

  const handleQuantityChange = (value) => {
    const nextQty = Math.max(1, parseInt(value, 10) || 1);
    const serialNumbers = serialSlots.slice(0, nextQty);
    while (serialNumbers.length < nextQty) serialNumbers.push('');
    dispatch({
      type: 'UPDATE_FORM',
      payload: { quantity: nextQty, serialNumbers },
    });
  };

  const handleSerialSelect = (slotIndex, value) => {
    const next = [...serialSlots];
    next[slotIndex] = value;
    dispatch({ type: 'UPDATE_FORM', payload: { serialNumbers: next } });
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
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

  const canConfirm = validationErrors.length === 0 && employee && form?.itemName;

  const handleConfirm = async () => {
    if (!form || !employee) return;
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
      dispatch({
        type: 'OPEN_SIGNATURE',
        payload: { mode: 'checkout', checkoutResult: result, label },
      });
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
        <h2>출고 데이터 검증</h2>
      </header>

      <section className="card">
        <h3>음성 인식 원문 (STT)</h3>
        <div className="stt-label">{transcript || '(없음)'}</div>
      </section>

      <section className="card">
        <h3>가공된 입력 폼</h3>
        {validationErrors.length > 0 && (
          <div className="validation-panel" role="alert">
            <strong>확인 필요</strong>
            <ul>
              {validationErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        {FORM_FIELDS.filter((f) => !f.show || f.show(form)).map((field) => (
          <div className="form-group" key={field.key}>
            <label>{field.label}</label>
            {renderFieldInput(field)}
          </div>
        ))}

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
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
      </section>

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

      <button
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={loading || !canConfirm}
      >
        {loading ? '처리 중...' : '출고 확정 → 서명'}
      </button>

      {state.status && <div className={`status-msg ${state.status.type}`}>{state.status.msg}</div>}

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
