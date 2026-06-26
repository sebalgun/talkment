import { useEffect, useRef } from 'react';
import { useApp, SCREENS } from '../context/AppContext';
import { useSheet } from '../context/SheetContext';
import { INVENTORY_MODES } from '../constants/inventoryModes';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { processVoiceCommand } from './VoiceCommandHandler';

export default function MicButton() {
  const { state, dispatch } = useApp();
  const { activeMode } = useSheet();
  const { listening, transcript, supported, start, stop, setTranscript } = useSpeechRecognition();
  const prevListening = useRef(false);

  // 먼저 계산해서 useEffect 의존성으로 사용
  const showMic =
    activeMode === INVENTORY_MODES.INTERNAL &&
    state.screen === SCREENS.DASHBOARD &&
    !state.signatureModal;

  useEffect(() => {
    dispatch({ type: 'SET_TRANSCRIPT', payload: transcript });
  }, [transcript, dispatch]);

  useEffect(() => {
    if (prevListening.current && !listening && transcript.trim()) {
      processVoiceCommand(transcript, dispatch);
    }
    prevListening.current = listening;
  }, [listening, transcript, dispatch]);

  // 외부 트리거 — showMic이 false면 리스너는 등록하되 실행하지 않음
  useEffect(() => {
    const handler = () => {
      if (!showMic || listening || state.loading) return;
      setTranscript('');
      start();
    };
    window.addEventListener('talkment_trigger_mic', handler);
    return () => window.removeEventListener('talkment_trigger_mic', handler);
  }, [showMic, listening, state.loading, start, setTranscript]);

  const toggleMic = () => {
    if (listening) stop();
    else {
      setTranscript('');
      start();
    }
  };

  if (!showMic) return null;

  return (
    <div className="mic-fab-container">
      {listening && (
        <div className="mic-transcript-bubble">{transcript || '듣는 중...'}</div>
      )}
      <button
        className={`mic-fab ${listening ? 'listening' : ''}`}
        onClick={toggleMic}
        disabled={state.loading}
        aria-label="음성 인식"
      >
        {state.loading ? (
          <span className="mic-icon spin">⟳</span>
        ) : listening ? (
          <span className="mic-icon">⏹</span>
        ) : (
          <span className="mic-icon">🎤</span>
        )}
      </button>
      <p className="mic-hint">
        {!supported ? 'Web Speech API 미지원 — 대시보드 입력창 사용' : listening ? '말씀 후 다시 눌러 분석' : '또는 대시보드에서 직접 입력'}
      </p>
    </div>
  );
}
