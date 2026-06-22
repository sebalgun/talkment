import { useState } from 'react';
import { api } from '../api/client';
import { todayISO } from '../utils/date';

export default function ManualCommandBar({ onSubmit, loading, placeholder }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) onSubmit(text.trim());
  };

  return (
    <form className="manual-cmd" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || '"홍길동 반납" 또는 "모니터 100-1 출고..."'}
        disabled={loading}
      />
      <button type="submit" className="btn btn-outline btn-sm" disabled={loading || !text.trim()}>
        실행
      </button>
    </form>
  );
}

/** 출고 폼 직접 열기 (음성·AI 파싱 없이) */
export function openManualCheckoutForm(dispatch) {
  dispatch({
    type: 'GO_FORM',
    payload: {
      transcript: '',
      parseResult: null,
      form: {
        itemType: 'serial',
        quantity: 1,
        serialNumbers: [],
        itemName: '',
        checkoutDate: todayISO(),
      },
      employee: null,
      employeeMatches: [],
      showDuplicateModal: false,
      status: null,
    },
  });
}

/** 반납 검색 */
export async function processReturnSearch(text, dispatch) {
  dispatch({ type: 'SET_LOADING', payload: true });
  dispatch({ type: 'SET_STATUS', payload: null });
  try {
    const query = text.replace(/반납|반입/g, '').trim() || text.trim();
    const items = await api.searchReturns(query);
    dispatch({
      type: 'GO_RETURN_LIST',
      payload: {
        query,
        items,
        transcript: text,
        status: items.length === 0 ? { type: 'error', msg: '미반납 항목이 없습니다.' } : null,
      },
    });
  } catch (e) {
    dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

/** 음성/텍스트 명령 공통 처리 */
export async function processVoiceCommand(text, dispatch) {
  dispatch({ type: 'SET_LOADING', payload: true });
  dispatch({ type: 'SET_STATUS', payload: null });

  try {
    const isReturn =
      /반납|반입/.test(text);

    if (isReturn) {
      await processReturnSearch(text, dispatch);
      return;
    }

    const result = await api.parseVoice(text);
    const { parsed, employeeMatches, needsDisambiguation } = result;

    if (parsed.intent === 'return') {
      const query = parsed.employeeName || parsed.itemName || parsed.serialNumber || text.replace(/반납|반입/g, '').trim();
      const items = await api.searchReturns(query);
      dispatch({
        type: 'GO_RETURN_LIST',
        payload: {
          query,
          items,
          transcript: text,
          status: items.length === 0 ? { type: 'error', msg: '미반납 항목이 없습니다.' } : null,
        },
      });
      return;
    }

    dispatch({
      type: 'GO_FORM',
      payload: {
        transcript: text,
        parseResult: result,
        form: {
          ...parsed,
          quantity: parsed.quantity || 1,
          serialNumbers: parsed.serialNumbers?.length
            ? parsed.serialNumbers
            : parsed.serialNumber
              ? [parsed.serialNumber]
              : [],
        },
        employee: needsDisambiguation ? null : employeeMatches[0] || null,
        employeeMatches,
        showDuplicateModal: needsDisambiguation,
        status: null,
      },
    });
  } catch (e) {
    dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

const MODE_HINTS = {
  checkout: {
    placeholder: '예: 홍길동 PC 100-1 출고',
    examples: '이름 + 품목 + 시리얼을 입력하거나, 아래 「출고 폼 직접 작성」을 사용하세요.',
  },
  return: {
    placeholder: '예: 홍길동 또는 100-1',
    examples: '출고자 이름, 품목명, 시리얼 넘버 중 하나만 입력해도 검색됩니다.',
  },
};

/** 대시보드 — 반출·반납 타이핑 UI */
export function CommandPanel({ dispatch, loading }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('checkout');

  const hint = MODE_HINTS[mode];

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (mode === 'return') {
      processReturnSearch(value, dispatch);
    } else {
      processVoiceCommand(value, dispatch);
    }
  };

  return (
    <section className="card command-panel">
      <h3 className="command-panel-title">출고 · 반납</h3>
      <p className="command-panel-desc">음성(🎤) 또는 아래에 직접 입력</p>

      <div className="command-mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'checkout'}
          className={mode === 'checkout' ? 'active' : ''}
          onClick={() => setMode('checkout')}
        >
          반출(출고)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'return'}
          className={mode === 'return' ? 'active' : ''}
          onClick={() => setMode('return')}
        >
          반납
        </button>
      </div>

      <form className="manual-cmd command-panel-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={hint.placeholder}
          disabled={loading}
          aria-label={mode === 'return' ? '반납 검색' : '출고 명령'}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !text.trim()}>
          {loading ? '처리 중...' : mode === 'return' ? '검색' : '출고'}
        </button>
      </form>

      <p className="command-hint">{hint.examples}</p>

      {mode === 'checkout' && (
        <button
          type="button"
          className="btn btn-outline btn-sm command-manual-btn"
          disabled={loading}
          onClick={() => openManualCheckoutForm(dispatch)}
        >
          출고 폼 직접 작성
        </button>
      )}
    </section>
  );
}
