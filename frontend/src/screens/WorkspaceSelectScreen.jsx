import { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPE_LABEL = {
  serial:     { text: '시리얼 관리', color: '#2563eb' },
  consumable: { text: '소모품 관리', color: '#16a34a' },
  both:       { text: '통합 관리',   color: '#7c3aed' },
};

function WorkspaceCard({ workspace, onSelect, isActive }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    api.getWorkspaceCardStats(workspace.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [workspace.id]);

  const type = TYPE_LABEL[workspace.inventoryType] || TYPE_LABEL.both;
  const hasSheet = !!workspace.sheets?.main?.spreadsheetId;

  return (
    <button
      className={`ws-card ${isActive ? 'ws-card-active' : ''}`}
      onClick={() => onSelect(workspace.id)}
    >
      <div className="ws-card-header">
        <div className="ws-card-name">{workspace.name}</div>
        <span className="ws-card-type-badge" style={{ background: type.color + '18', color: type.color }}>
          {type.text}
        </span>
      </div>

      {!hasSheet ? (
        <div className="ws-card-no-sheet">⚠️ 시트 미연결</div>
      ) : loadingStats ? (
        <div className="ws-card-stats ws-card-stats-loading">
          <span>통계 불러오는 중...</span>
        </div>
      ) : stats ? (
        <div className="ws-card-stats">
          <div className="ws-card-stat">
            <span className="ws-card-stat-num">{stats.itemCount}</span>
            <span className="ws-card-stat-lbl">총 품목</span>
          </div>
          <div className="ws-card-stat-sep" />
          <div className={`ws-card-stat ${stats.unreturned > 0 ? 'ws-card-stat-warn' : ''}`}>
            <span className="ws-card-stat-num">{stats.unreturned}</span>
            <span className="ws-card-stat-lbl">미반납</span>
          </div>
          {stats.lowStock > 0 && (
            <>
              <div className="ws-card-stat-sep" />
              <div className="ws-card-stat ws-card-stat-danger">
                <span className="ws-card-stat-num">{stats.lowStock}</span>
                <span className="ws-card-stat-lbl">재고 부족</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ws-card-stats ws-card-stats-loading">
          <span>통계 조회 실패</span>
        </div>
      )}

      {isActive && <div className="ws-card-active-dot" />}
    </button>
  );
}

export default function WorkspaceSelectScreen({ onSelect, onAddNew }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.listWorkspaces(), api.getOnboardingStatus()])
      .then(([ws, status]) => {
        setWorkspaces(ws.workspaces || []);
        setActiveId(status.activeWorkspaceId);
      })
      .catch(() => setError('목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id) => {
    if (activating) return;
    setActivating(id);
    try {
      await api.activateWorkspace(id);
      setActiveId(id);
      onSelect(id);
    } catch (e) {
      setError(e.message || '작업 공간 전환에 실패했습니다.');
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="ws-select-screen">
        <div className="ws-select-loading">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="ws-select-screen">
      {/* 헤더 */}
      <div className="ws-select-header">
        <h1 className="ws-select-app-name">Talkment</h1>
        <p className="ws-select-tagline">말로하는 관리 프로그램</p>
      </div>

      <h2 className="ws-select-title">작업 공간 선택</h2>

      {error && <div className="status-msg error" style={{ margin: '0 16px 12px' }}>{error}</div>}

      {/* 워크스페이스 카드 목록 */}
      <div className="ws-card-list">
        {workspaces.length === 0 ? (
          <div className="ws-empty">
            <div className="ws-empty-icon">📦</div>
            <div className="ws-empty-text">등록된 프로젝트가 없습니다</div>
            <div className="ws-empty-hint">아래 버튼으로 첫 프로젝트를 만들어 보세요</div>
          </div>
        ) : (
          workspaces.map((ws) => (
            <div key={ws.id} style={{ position: 'relative' }}>
              {activating === ws.id && (
                <div className="ws-card-activating">전환 중...</div>
              )}
              <WorkspaceCard
                workspace={ws}
                isActive={ws.id === activeId}
                onSelect={handleSelect}
              />
            </div>
          ))
        )}
      </div>

      {/* 새 프로젝트 추가 버튼 */}
      <div className="ws-add-section">
        <button className="ws-add-btn" onClick={onAddNew}>
          <span className="ws-add-icon">＋</span>
          <span>새 프로젝트 추가</span>
        </button>
      </div>
    </div>
  );
}
