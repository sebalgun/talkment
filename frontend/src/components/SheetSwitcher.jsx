import { useState, useRef, useEffect } from 'react';
import { useSheet } from '../context/SheetContext';

export default function SheetSwitcher({ onManage }) {
  const { sheets, activeSheet, switchSheet, version } = useSheet();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (sheets.length === 0) return null;

  const handleSwitch = (sheetId) => {
    switchSheet(sheetId);
    setOpen(false);
  };

  return (
    <div className="sheet-switcher" ref={ref}>
      <button
        className="sheet-switcher-btn"
        onClick={() => setOpen(!open)}
        title="스프레드시트 전환"
      >
        <span className="sheet-switcher-label">{activeSheet?.alias || '시트 선택'}</span>
        <span className="sheet-switcher-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="sheet-switcher-menu">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              className={`sheet-switcher-item ${activeSheet?.id === sheet.id ? 'active' : ''}`}
              onClick={() => handleSwitch(sheet.id)}
            >
              <strong>{sheet.alias}</strong>
              <span>{sheet.title}</span>
            </button>
          ))}
          <button className="sheet-switcher-manage" onClick={() => { setOpen(false); onManage?.(); }}>
            + 시트 추가 / 관리
          </button>
        </div>
      )}
    </div>
  );
}
