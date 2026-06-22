import { useEffect, useCallback, useState } from 'react';
import { api } from '../api/client';
import { useApp, getSheetTabsForMode } from '../context/AppContext';
import { useSheet } from '../context/SheetContext';
import {
  processVoiceCommand,
  processReturnSearch,
  openManualCheckoutForm,
} from '../components/VoiceCommandHandler';
import {
  AssetGroupCard,
  AssetCard,
  SerialLogCard,
  ConsumableCard,
  LogCard,
  EmployeeCard,
  isSerialOut,
} from '../components/SheetItemCards';

function groupAssets(assets) {
  const map = new Map();
  for (const a of assets) {
    const name = a['항목'] || '(미분류)';
    if (!map.has(name)) map.set(name, { itemName: name, total: 0, checkedOut: 0, items: [] });
    const g = map.get(name);
    g.total++;
    if (isSerialOut(a['상태'])) g.checkedOut++;
    g.items.push(a);
  }
  return [...map.values()];
}

export default function DashboardScreen() {
  const { state, dispatch } = useApp();
  const { version, activeSheet } = useSheet();

  const [summary, setSummary] = useState({ available: 0, unreturned: 0, consumable: 0 });
  const [assets, setAssets] = useState([]);
  const [tabData, setTabData] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // 반출/반납 입력
  const [mode, setMode] = useState('checkout');
  const [text, setText] = useState('');

  const sheetTabs = getSheetTabsForMode();

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const [assetList, serialLog, master, log] = await Promise.all([
        api.getAssets(),
        api.getSerialLog(),
        api.getConsumableMaster(),
        api.getConsumableLog(),
      ]);

      setAssets(assetList);
      setSummary({
        available: assetList.filter((r) => !isSerialOut(r['상태'])).length,
        unreturned: serialLog.filter((r) => !String(r['반납일'] || '').trim()).length,
        consumable: master.reduce((s, m) => s + parseInt(m['현재 잔여갯수'] || 0, 10), 0),
      });

      const tab = sheetTabs.find((t) => t.id === state.sheetTab);
      if (tab?.id === 'assets') setTabData(assetList);
      else if (tab?.id === 'serialLog') setTabData(serialLog);
      else if (tab?.id === 'consumableMaster') setTabData(master);
      else if (tab?.id === 'consumableLog') setTabData(log);
      else if (tab?.id === 'employees') {
        const emp = await api.getEmployees();
        setTabData(emp);
      }
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    } finally {
      setFetching(false);
    }
  }, [state.sheetTab, state.refreshKey, dispatch, version]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setSelectedGroup(null); }, [state.sheetTab]);

  const openRow = (row) =>
    dispatch({ type: 'GO_ROW_DETAIL', payload: { row, tab: state.sheetTab } });

  const openUnreturnedDetail = async () => {
    if (summary.unreturned === 0) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'info', msg: '미반납 항목이 없습니다.' } });
      return;
    }
    try {
      const items = await api.searchReturns('');
      dispatch({
        type: 'GO_RETURN_LIST',
        payload: { query: '전체 미반납 현황', items, status: null },
      });
    } catch (e) {
      dispatch({ type: 'SET_STATUS', payload: { type: 'error', msg: e.message } });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    if (mode === 'return') processReturnSearch(value, dispatch);
    else processVoiceCommand(value, dispatch);
  };

  const handleModeChange = (m) => {
    setMode(m);
    setText('');
  };

  const renderTabCards = () => {
    if (fetching) return <div className="empty">불러오는 중...</div>;
    if (tabData.length === 0) return <div className="empty">데이터가 없습니다</div>;

    if (state.sheetTab === 'assets') {
      if (selectedGroup) {
        return selectedGroup.items.map((d) => (
          <AssetCard key={d._rowIndex} item={d} onOpen={() => openRow(d)} />
        ));
      }
      return groupAssets(tabData).map((g) => (
        <AssetGroupCard key={g.itemName} group={g} onOpen={() => setSelectedGroup(g)} />
      ));
    }
    if (state.sheetTab === 'serialLog')
      return tabData.map((d) => <SerialLogCard key={d._rowIndex} item={d} onOpen={() => openRow(d)} />);
    if (state.sheetTab === 'consumableMaster')
      return tabData.map((d) => <ConsumableCard key={d._rowIndex} item={d} onOpen={() => openRow(d)} />);
    if (state.sheetTab === 'consumableLog')
      return tabData.map((d) => <LogCard key={d._rowIndex} item={d} onOpen={() => openRow(d)} />);
    if (state.sheetTab === 'employees')
      return tabData.map((d) => <EmployeeCard key={d._rowIndex} item={d} onOpen={() => openRow(d)} />);
    return null;
  };

  const currentTabLabel = sheetTabs.find((t) => t.id === state.sheetTab)?.label;
  const assetGroups = groupAssets(assets);

  return (
    <div className="screen screen-dashboard">

      {/* ── 상단 요약 칩 ── */}
      <div className="dash-stats">
        <button
          className="dash-stat-chip"
          onClick={() => dispatch({ type: 'GO_SUMMARY_DETAIL', payload: { type: 'available' } })}
        >
          <span className="dash-stat-num">{summary.available}</span>
          <span className="dash-stat-lbl">출고가능</span>
        </button>
        <div className="dash-stat-sep" />
        <button
          className={`dash-stat-chip ${summary.unreturned > 0 ? 'dash-stat-warn' : ''}`}
          onClick={openUnreturnedDetail}
        >
          <span className="dash-stat-num">{summary.unreturned}</span>
          <span className="dash-stat-lbl">미반납</span>
        </button>
        <div className="dash-stat-sep" />
        <button
          className="dash-stat-chip"
          onClick={() => dispatch({ type: 'GO_SUMMARY_DETAIL', payload: { type: 'consumable' } })}
        >
          <span className="dash-stat-num">{summary.consumable}</span>
          <span className="dash-stat-lbl">소모품 잔여</span>
        </button>
      </div>

      {/* ── 반출 · 반납 액션 카드 ── */}
      <div className="dash-action-card">
        <div className="dash-mode-btns">
          <button
            type="button"
            className={`dash-mode-btn ${mode === 'checkout' ? 'active' : ''}`}
            onClick={() => handleModeChange('checkout')}
          >
            📤 반출
          </button>
          <button
            type="button"
            className={`dash-mode-btn ${mode === 'return' ? 'active' : ''}`}
            onClick={() => handleModeChange('return')}
          >
            📥 반납
          </button>
        </div>

        <form className="dash-input-row" onSubmit={handleSubmit}>
          <input
            className="dash-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === 'checkout'
                ? '이름 + 품목 + 시리얼 (예: 홍길동 PC 100-1)'
                : '이름, 품목, 시리얼 중 하나 입력'
            }
            disabled={state.loading}
            autoComplete="off"
          />
          <button
            type="submit"
            className={`dash-submit-btn ${mode === 'return' ? 'return' : ''}`}
            disabled={state.loading || !text.trim()}
          >
            {state.loading ? '⟳' : mode === 'return' ? '검색' : '출고'}
          </button>
        </form>

        <div className="dash-action-footer">
          <span className="dash-mic-hint">🎤 화면 아래 버튼으로 음성 입력 가능</span>
          {mode === 'checkout' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={state.loading}
              onClick={() => openManualCheckoutForm(dispatch)}
            >
              폼 직접 작성
            </button>
          )}
        </div>
      </div>

      {/* ── 물품 현황 ── */}
      {assetGroups.length > 0 && (
        <div className="dash-inventory">
          <div className="dash-inventory-header">
            <span>물품 현황</span>
            {fetching && <span className="dash-fetching">···</span>}
          </div>
          <div className="dash-asset-grid">
            {assetGroups.map((g) => (
              <AssetGroupCard
                key={g.itemName}
                group={g}
                onOpen={() => {
                  dispatch({ type: 'SET_SHEET_TAB', payload: 'assets' });
                  setSelectedGroup(g);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 상세 데이터 탭 (스크롤 아래) ── */}
      <div className="dash-detail-section">
        <nav className="sheet-tab-bar">
          {sheetTabs.map((tab) => (
            <button
              key={tab.id}
              className={state.sheetTab === tab.id ? 'active' : ''}
              onClick={() => dispatch({ type: 'SET_SHEET_TAB', payload: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="card-grid">
          <div className="card-grid-header">
            {selectedGroup && state.sheetTab === 'assets' ? (
              <>
                <button className="back-btn" onClick={() => setSelectedGroup(null)}>← 목록</button>
                <h2>{selectedGroup.itemName}</h2>
              </>
            ) : (
              <>
                <h2>{currentTabLabel}</h2>
                <span className="card-grid-hint">탭하여 상세 · 수정</span>
              </>
            )}
          </div>
          {renderTabCards()}
        </div>
      </div>

      {state.status && (
        <div className={`status-msg ${state.status.type} status-floating`}>
          {state.status.msg}
        </div>
      )}
    </div>
  );
}
