import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

function getReturnLabel(item) {
  return `${item['항목']} 반납 (${item['출고자']})`;
}

export default function ReturnListScreen() {
  const { state, dispatch, goDashboard } = useApp();
  const { returnItems, returnQuery, loading } = state;
  const [fieldOptions, setFieldOptions] = useState({ requireSignature: true });

  useEffect(() => {
    api.getFieldOptions().then(setFieldOptions).catch(() => {});
  }, []);

  const handleConfirmReturn = async (item) => {
    if (fieldOptions.requireSignature) {
      dispatch({
        type: 'OPEN_SIGNATURE',
        payload: { mode: 'return', returnItem: item, label: getReturnLabel(item) },
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await api.processReturn(item);
      goDashboard({ type: 'success', msg: `${getReturnLabel(item)} 완료` });
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="screen screen-return-list">
      <header className="screen-header">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <h2>미반납 검색 결과</h2>
      </header>

      <section className="card">
        <h3>검색어</h3>
        <div className="stt-label">{returnQuery || '(전체)'}</div>
        <p className="result-count">{returnItems.length}건의 미반납 항목</p>
      </section>

      {returnItems.length === 0 ? (
        <div className="empty">미반납 항목이 없습니다.</div>
      ) : (
        <ul className="return-list">
          {returnItems.map((item, i) => (
            <li key={i} className="return-list-item">
              <div className="return-list-body">
                <strong>{item['항목']}</strong>
                {item['시리얼 넘버'] && (
                  <span className="return-serial"> — {item['시리얼 넘버']}</span>
                )}
                <div className="data-card-meta">
                  {item['출고자']} · {item['소속']}
                </div>
                <div className="data-card-meta">
                  출고 {item['출고일'] || item['반출일'] || '-'}
                </div>
                <span className="badge badge-warn">
                  {item['비고'] || '미반납'}
                </span>
              </div>
              <button
                className="btn btn-primary btn-action"
                onClick={() => handleConfirmReturn(item)}
                disabled={loading}
              >
                반납 확정
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.status && <div className={`status-msg ${state.status.type}`}>{state.status.msg}</div>}
    </div>
  );
}
