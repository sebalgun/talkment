import { useEffect, useCallback, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useSheet } from '../context/SheetContext';
import { processReturnSearch, openManualCheckoutForm } from '../components/VoiceCommandHandler';

// ── 재고 아이템 그룹화 ────────────────────────────────────────
function groupInventory(items) {
  const map = new Map();
  for (const item of items) {
    const name = item._itemName;
    if (!map.has(name)) {
      map.set(name, { itemName: name, type: item._type, items: [] });
    }
    const group = map.get(name);
    if (group.type !== item._type) group.type = 'mixed';
    group.items.push(item);
  }
  return [...map.values()];
}

// ── 품목 그룹 카드 (아코디언) ──────────────────────────────────
function ItemGroupCard({ group, onItemClick }) {
  const [expanded, setExpanded] = useState(false);

  const isSerial = group.type === 'serial';
  const total = isSerial
    ? group.items.length
    : group.items.reduce((s, i) => s + (parseInt(i._quantity) || 0), 0);
  const checkedOut = isSerial
    ? group.items.filter((i) => i._status !== 'available').length
    : null;

  return (
    <div className={`item-group-card${expanded ? ' item-group-card-open' : ''}`}>
      <button className="item-group-header" onClick={() => setExpanded(!expanded)}>
        <div className="item-group-left">
          <span className="item-group-name">{group.itemName}</span>
        </div>
        <div className="item-group-stats">
          <div className="item-group-stat">
            <span className="item-group-stat-num">{total}</span>
            <span className="item-group-stat-lbl">총 갯수</span>
          </div>
          {isSerial && (
            <div className={`item-group-stat${checkedOut > 0 ? ' item-stat-warn' : ''}`}>
              <span className="item-group-stat-num">{checkedOut}</span>
              <span className="item-group-stat-lbl">반출</span>
            </div>
          )}
          <div className="item-group-stat">
            <span className="item-group-stat-num">0</span>
            <span className="item-group-stat-lbl">연체</span>
          </div>
        </div>
        <span className="item-group-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="item-group-detail">
          {isSerial ? (
            <div className="inv-serial-list inv-serial-list-inset">
              {group.items.map((item) => (
                <button
                  key={item._rowIndex}
                  className="inv-serial-row"
                  onClick={() => onItemClick(item)}
                >
                  <span className={`inv-status-dot ${item._status === 'available' ? 'available' : 'checked-out'}`} />
                  <span className="inv-serial-num">{item._serialNumber}</span>
                  {item._spec && <span className="inv-serial-spec">{item._spec}</span>}
                  <span className={`inv-status-text ${item._status === 'available' ? 'text-ok' : 'text-danger'}`}>
                    {item._status === 'available' ? '보유중' : '반출완료'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            group.items.map((item) => (
              <button
                key={item._rowIndex}
                className="item-detail-row"
                onClick={() => onItemClick(item)}
              >
                <div className="inv-consumable-row">
                  <div>
                    <div className="inv-group-name">{item._itemName}</div>
                    {item._spec && <div className="inv-consumable-spec">{item._spec}</div>}
                  </div>
                  <div className="inv-consumable-right">
                    <span className={`inv-consumable-qty ${item._isLowStock ? 'qty-low' : ''}`}>
                      {item._quantity}
                    </span>
                    <span className="inv-consumable-unit">개</span>
                  </div>
                </div>
                {item._isLowStock && (
                  <div className="inv-low-stock">⚠️ 재고 부족 — 최소 {item._minQuantity}개</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── 메인 대시보드 ─────────────────────────────────────────────
export default function DashboardScreen() {
  const { state, dispatch } = useApp();
  const { version } = useSheet();

  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ returns: { unreturned: 0, overdue: 0 } });
  const [statsError, setStatsError] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [returnQuery, setReturnQuery] = useState('');
  const [showReturnInput, setShowReturnInput] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setStatsError(false);
    try {
      const [inv, st] = await Promise.all([
        api.getInventory(),
        api.getDashboardStats().catch(() => { setStatsError(true); return null; }),
      ]);
      setInventory(inv);
      if (st) setStats(st);
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    } finally {
      setFetching(false);
    }
  }, [state.refreshKey, dispatch, version]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleItemClick = (item) => {
    const tab = item._source === 'inventoryMaster'
      ? 'inventoryMaster'
      : item._type === 'serial' ? 'assets' : 'consumableMaster';
    dispatch({ type: 'GO_ROW_DETAIL', payload: { row: item, tab } });
  };

  const handleUnreturnedClick = async () => {
    if (stats.returns.unreturned === 0) return;
    try {
      const items = await api.searchReturns('');
      dispatch({ type: 'GO_RETURN_LIST', payload: { query: '전체 미반납', items, status: null } });
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    }
  };

  const handleReturnSearch = (e) => {
    e.preventDefault();
    if (!returnQuery.trim()) return;
    processReturnSearch(returnQuery.trim(), dispatch);
    setReturnQuery('');
    setShowReturnInput(false);
  };

  const groups = groupInventory(inventory);
  const itemTypeCount = groups.length;
  const totalQuantity = inventory.reduce((sum, item) => {
    if (item._type === 'serial') return sum + 1;
    return sum + (parseInt(item._quantity) || 0);
  }, 0);
  const { unreturned = 0, overdue = 0 } = stats.returns || {};

  return (
    <div className="screen screen-dashboard">

      {/* ── 입력 힌트 배너 ── */}
      <div className="dash-hint-banner">
        <span className="dash-hint-icon">💬</span>
        <span>직접 입력 <span className="dash-hint-arrow">→</span> 말씀하세요. AI가 자동으로 처리합니다</span>
      </div>

      {/* ── 요약 칩 ── */}
      <div className="dash-stats">
        <div className="dash-stat-chip">
          <span className="dash-stat-num">{itemTypeCount}</span>
          <span className="dash-stat-lbl">총 품목 종류</span>
        </div>
        <div className="dash-stat-sep" />
        <div className="dash-stat-chip">
          <span className="dash-stat-num">{totalQuantity}</span>
          <span className="dash-stat-lbl">총 갯수</span>
        </div>
        <div className="dash-stat-sep" />
        <button
          className={`dash-stat-chip ${unreturned > 0 ? 'dash-stat-warn' : ''}`}
          onClick={handleUnreturnedClick}
        >
          <span className="dash-stat-num">{unreturned}</span>
          <span className="dash-stat-lbl">반출</span>
        </button>
        <div className="dash-stat-sep" />
        <div className={`dash-stat-chip ${overdue > 0 ? 'dash-stat-danger' : ''}`}>
          <span className="dash-stat-num">{overdue}</span>
          <span className="dash-stat-lbl">연체</span>
        </div>
      </div>

      {/* ── 통계 오류 안내 ── */}
      {statsError && (
        <div className="status-msg error" style={{ margin: '0 16px 8px', fontSize: '0.8rem' }}>
          통계 조회 실패 — 반출·연체 수치를 불러오지 못했습니다
        </div>
      )}

      {/* ── 연체 배너 ── */}
      {overdue > 0 && (
        <button className="dash-overdue-banner" onClick={handleUnreturnedClick}>
          ⚠️ 반납 연체 {overdue}건 — 예정일 초과 항목이 있습니다
        </button>
      )}

      {/* ── 재고 목록 ── */}
      <div className="inv-section">
        <div className="inv-section-header">
          <span>재고 현황</span>
          {fetching && <span className="dash-fetching">···</span>}
        </div>

        {!fetching && groups.length === 0 && (
          <div className="empty-hint">
            [물품관리] 시트에 데이터가 없습니다
          </div>
        )}

        {groups.map((group) =>
          group.type === 'mixed' ? (
            group.items.map((item) => (
              <ItemGroupCard
                key={item._rowIndex}
                group={{ itemName: group.itemName, type: item._type, items: [item] }}
                onItemClick={handleItemClick}
              />
            ))
          ) : (
            <ItemGroupCard
              key={group.itemName}
              group={group}
              onItemClick={handleItemClick}
            />
          )
        )}
      </div>

      {/* ── 보조 액션 ── */}
      <div className="dash-secondary-actions">
        {showReturnInput ? (
          <form className="dash-return-form" onSubmit={handleReturnSearch}>
            <input
              autoFocus
              value={returnQuery}
              onChange={(e) => setReturnQuery(e.target.value)}
              placeholder="이름, 품목, 시리얼 입력"
              className="dash-return-input"
            />
            <button type="submit" className="btn btn-outline btn-sm">검색</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReturnInput(false)}>취소</button>
          </form>
        ) : (
          <div className="dash-action-btns">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openManualCheckoutForm(dispatch)}
            >
              📝 직접 입력 (반출)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowReturnInput(true)}
            >
              📥 반납 검색
            </button>
          </div>
        )}
      </div>

      {/* ── 상태 메시지 ── */}
      {state.status && (
        <div className={`status-msg ${state.status.type} status-floating`}>
          {state.status.msg}
        </div>
      )}
    </div>
  );
}
