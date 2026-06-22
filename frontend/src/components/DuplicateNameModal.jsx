export default function DuplicateNameModal({ matches, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>동명이인 — 소속을 선택하세요</h2>
        {matches.map((emp, i) => (
          <div
            key={i}
            className="list-item"
            onClick={() => onSelect(emp)}
          >
            <strong>{emp['이름']}</strong>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
              {emp['소속']} · {emp['직함']} · {emp['연락처']}
            </div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={onClose} style={{ marginTop: 12 }}>
          취소
        </button>
      </div>
    </div>
  );
}
