import { getReturnStatusLabel } from '../utils/returnStatus';

export function isSerialOut(status) {
  const s = String(status || '').trim();
  return s === '반출' || s === '대여중' || s === '반출완료';
}

export function AssetCard({ item, onOpen }) {
  const statusText = item['상태'] || '재고';
  const out = isSerialOut(item['상태']);
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{item['항목']}</strong>
        <span className={`badge ${out ? 'badge-warn' : 'badge-ok'}`}>{statusText || '재고'}</span>
      </div>
      {item['시리얼 넘버'] && (
        <div className="data-card-meta">S/N {item['시리얼 넘버']}</div>
      )}
    </div>
  );
}

export function SerialLogCard({ item, onOpen }) {
  const status = getReturnStatusLabel(item);
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{item['항목']}</strong>
        <span className={`badge ${status.warn ? 'badge-warn' : status.text === '반납완료' ? 'badge-ok' : 'badge-neutral'}`}>
          {status.text}
        </span>
      </div>
      {item['시리얼 넘버'] && (
        <div className="data-card-meta">S/N {item['시리얼 넘버']}</div>
      )}
      <div className="data-card-meta">
        {item['출고자']} · {item['소속']}
      </div>
      <div className="data-card-meta">출고 {item['출고일'] || item['반출일'] || '-'}</div>
    </div>
  );
}

export function ConsumableCard({ item, onOpen }) {
  const totalOut = item['출고 총갯수'] || item['츌고 총갯수'] || 0;
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{item['항목']}</strong>
        <span className="stat-value-sm">{item['현재 잔여갯수']}개</span>
      </div>
      <div className="data-card-meta">
        초기 {item['초기 재고수량']} · 출고 {totalOut}
      </div>
    </div>
  );
}

export function LogCard({ item, onOpen }) {
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{item['항목']}</strong> × {item['출고갯수']}
      </div>
      <div className="data-card-meta">
        {item['출고자']} · {item['출고일']}
      </div>
      <div className="data-card-meta">{item['소속']} · {item['직책'] || item['직함'] || ''}</div>
    </div>
  );
}

export function AssetGroupCard({ group, onOpen }) {
  const available = group.total - group.checkedOut;
  const allOut = available === 0;
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{group.itemName}</strong>
        <span className={`badge ${allOut ? 'badge-warn' : 'badge-ok'}`}>
          {available}/{group.total}
        </span>
      </div>
      <div className="data-card-meta">
        총 {group.total}개 · 반출 {group.checkedOut}개 · 가용 {available}개
      </div>
    </div>
  );
}

export function EmployeeCard({ item, onOpen }) {
  return (
    <div className="data-card data-card-clickable" onClick={onOpen} role="button" tabIndex={0}>
      <div className="data-card-header">
        <strong>{item['이름']}</strong>
        <span className="data-card-meta">{item['직함']}</span>
      </div>
      <div className="data-card-meta">{item['소속']} · {item['연락처']}</div>
    </div>
  );
}
