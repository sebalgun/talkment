import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useSheet } from '../context/SheetContext';
import { AssetCard, ConsumableCard, isSerialOut } from '../components/SheetItemCards';

const SUMMARY_CONFIG = {
  available: {
    title: '출고 가능',
    subtitle: '재고 상태인 시리얼 물품',
    tab: 'assets',
    load: async () => {
      const assets = await api.getAssets();
      return assets.filter((r) => !isSerialOut(r['상태']));
    },
    renderItem: (item, onOpen) => (
      <AssetCard key={item._rowIndex} item={item} onOpen={onOpen} />
    ),
  },
  consumable: {
    title: '일반물품 현황',
    subtitle: '품목별 잔여 수량',
    tab: 'consumableMaster',
    load: () => api.getConsumableMaster(),
    renderItem: (item, onOpen) => (
      <ConsumableCard key={item._rowIndex} item={item} onOpen={onOpen} />
    ),
  },
};

export default function SummaryDetailScreen() {
  const { state, dispatch, goDashboard } = useApp();
  const { version } = useSheet();
  const config = SUMMARY_CONFIG[state.summaryDetailType];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    setLoading(true);
    config
      .load()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) {
          dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, state.refreshKey, version, dispatch]);

  if (!config) {
    return (
      <div className="screen">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <div className="empty">표시할 데이터가 없습니다</div>
      </div>
    );
  }

  const openRow = (row) => {
    dispatch({ type: 'GO_ROW_DETAIL', payload: { row, tab: config.tab } });
  };

  return (
    <div className="screen screen-summary-detail">
      <header className="screen-header">
        <button className="back-btn" onClick={goDashboard}>← 대시보드</button>
        <h2>{config.title}</h2>
      </header>

      <section className="card summary-detail-intro">
        <p className="summary-detail-subtitle">{config.subtitle}</p>
        <p className="result-count">{loading ? '불러오는 중...' : `${items.length}건`}</p>
      </section>

      <div className="card-grid card-grid-flat">
        {!loading && items.length === 0 && (
          <div className="empty">표시할 데이터가 없습니다</div>
        )}
        {!loading && items.map((item) => config.renderItem(item, () => openRow(item)))}
      </div>

      {state.status && <div className={`status-msg ${state.status.type}`}>{state.status.msg}</div>}
    </div>
  );
}
