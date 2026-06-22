import { useRef, useEffect, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { SHEET_TAB_NAMES } from '../constants/sheets';

export default function SignatureModal() {
  const { state, dispatch, goDashboard } = useApp();
  const modal = state.signatureModal;
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!modal) return;
    setError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [modal]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const checkoutSignatureColumn = (sheet) => {
    if (sheet === SHEET_TAB_NAMES.CONSUMABLE_LOG) return 'consumableCheckout';
    return 'checkout';
  };

  const handleComplete = async () => {
    if (!modal) return;
    setSubmitting(true);
    setError(null);
    try {
      const base64 = canvasRef.current.toDataURL('image/png');
      let textOnly = false;

      if (modal.mode === 'checkout') {
        const { checkoutResult } = modal;
        const rowIndexes = checkoutResult.rowIndexes?.length
          ? checkoutResult.rowIndexes
          : [checkoutResult.rowIndex];
        const column = checkoutSignatureColumn(checkoutResult.sheet);
        for (const rowIndex of rowIndexes) {
          const res = await api.uploadSignature({
            sheet: checkoutResult.sheet,
            rowIndex,
            column,
            base64,
          });
          if (res.mode === 'text-only') textOnly = true;
        }
        dispatch({ type: 'CLOSE_SIGNATURE' });
        goDashboard({
          type: 'success',
          msg: textOnly
            ? '출고가 완료되었습니다. (서명 이미지는 Drive 설정 후 저장됩니다)'
            : '출고 및 서명이 완료되었습니다.',
        });
      } else {
        const { returnItem } = modal;
        const result = await api.processReturn(returnItem);
        const res = await api.uploadSignature({
          sheet: SHEET_TAB_NAMES.SERIAL_LOG,
          rowIndex: result.rowIndex,
          column: 'return',
          base64,
        });
        dispatch({ type: 'CLOSE_SIGNATURE' });
        goDashboard({
          type: 'success',
          msg: res.mode === 'text-only'
            ? '반납이 완료되었습니다. (서명 이미지는 Drive 설정 후 저장됩니다)'
            : '반납 및 서명이 완료되었습니다.',
        });
      }
    } catch (e) {
      setError(e.message || '서명 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!modal) return null;

  const completeLabel = modal.mode === 'checkout' ? '출고 완료' : '반납 완료';

  return (
    <div className="modal-overlay modal-signature" onClick={() => dispatch({ type: 'CLOSE_SIGNATURE' })}>
      <div className="modal modal-signature-panel" onClick={(e) => e.stopPropagation()}>
        <h2>서명 — {modal.label}</h2>
        <p className="signature-hint">아래 영역에 터치 또는 마우스로 서명해 주세요.</p>

        {error && (
          <div className="status-msg error form-inline-error" role="alert">
            {error}
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="signature-canvas signature-canvas-lg"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />

        <div className="signature-actions">
          <button className="btn btn-outline" onClick={clear} disabled={submitting}>
            초기화
          </button>
          <button className="btn btn-primary" onClick={handleComplete} disabled={submitting}>
            {submitting ? '저장 중...' : completeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
