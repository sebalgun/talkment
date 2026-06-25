import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

function parseDate(raw) {
  if (!raw) return null;
  return String(raw).replace(/\./g, '-').trim().slice(0, 10);
}

function isOverdue(item) {
  const today = new Date().toISOString().slice(0, 10);
  const due = parseDate(item['반납예정일']);
  const returned = String(item['반납일'] || '').trim();
  return !returned && !!due && due < today;
}

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    const raw = item['출고일'] || item['반출일'];
    const date = parseDate(raw) || '날짜 없음';
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (b === '날짜 없음' ? -1 : a === '날짜 없음' ? 1 : b.localeCompare(a)))
    .map(([date, items]) => ({ date, items }));
}

export default function HistoryScreen() {
  const [log, setLog] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await api.getSerialLog();
      setLog(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = log.filter((item) => {
    const returned = String(item['반납일'] || '').trim();
    if (filterStatus === 'unreturned' && returned) return false;
    if (filterStatus === 'returned' && !returned) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        String(item['항목'] || '').toLowerCase().includes(q) ||
        String(item['출고자'] || '').toLowerCase().includes(q) ||
        String(item['시리얼 넘버'] || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groups = groupByDate(filtered);

  return (
    <div className="screen-history">
      <div className="history-toolbar">
        <input
          className="history-search"
          type="text"
          placeholder="품목, 이름, 시리얼 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="history-filters">
          {[
            { id: 'all', label: '전체' },
            { id: 'unreturned', label: '미반납' },
            { id: 'returned', label: '반납완료' },
          ].map((f) => (
            <button
              key={f.id}
              className={`history-filter-btn ${filterStatus === f.id ? 'active' : ''}`}
              onClick={() => setFilterStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {fetching && <div className="empty">불러오는 중...</div>}
      {error && <div className="status-msg error">{error}</div>}
      {!fetching && !error && groups.length === 0 && (
        <div className="empty">해당 항목이 없습니다.</div>
      )}

      <div className="history-timeline">
        {groups.map(({ date, items }) => (
          <div key={date} className="history-date-group">
            <div className="history-date-label">{date}</div>
            {items.map((item, i) => {
              const returned = String(item['반납일'] || '').trim();
              const overdue = isOverdue(item);
              const status = returned ? 'returned' : overdue ? 'overdue' : 'out';
              return (
                <div key={i} className="history-item">
                  <div className="history-item-dot" data-status={status} />
                  <div className="history-item-body">
                    <div className="history-item-main">
                      <strong>{item['항목'] || '(항목 없음)'}</strong>
                      {item['시리얼 넘버'] && (
                        <span className="history-item-serial"> {item['시리얼 넘버']}</span>
                      )}
                    </div>
                    <div className="history-item-meta">
                      {item['출고자']}
                      {item['소속'] ? ` · ${item['소속']}` : ''}
                    </div>
                    {returned && (
                      <div className="history-item-return">반납: {returned}</div>
                    )}
                    {!returned && item['반납예정일'] && (
                      <div className={`history-item-due ${overdue ? 'overdue' : ''}`}>
                        반납예정: {item['반납예정일']}
                        {overdue && ' (연체)'}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${status === 'returned' ? 'badge-ok' : status === 'overdue' ? 'badge-danger' : 'badge-warn'}`}>
                    {status === 'returned' ? '반납' : status === 'overdue' ? '연체' : '출고중'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
