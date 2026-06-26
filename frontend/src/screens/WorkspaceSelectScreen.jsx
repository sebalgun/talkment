import { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPE_LABEL = {
  serial:     { text: '시리얼 관리', color: '#2563eb' },
  consumable: { text: '소모품 관리', color: '#16a34a' },
  both:       { text: '통합 관리',   color: '#7c3aed' },
};

function WorkspaceCard({ workspace, onSelect, isActive, onRename, onDelete }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(null); // null = not editing
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    api.getWorkspaceCardStats(workspace.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [workspace.id]);

  const type = TYPE_LABEL[workspace.inventoryType] || TYPE_LABEL.both;
  const hasSheet = !!workspace.sheets?.main?.spreadsheetId;

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  const handleRenameClick = (e) => {
    e.stopPropagation();
    setEditingName(workspace.name);
    setMenuOpen(false);
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm(`"${workspace.name}" 작업 공간을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await api.deleteWorkspace(workspace.id);
      onDelete(workspace.id);
    } catch (err) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  };

  const handleRenameSubmit = async () => {
    if (!editingName?.trim()) return;
    setRenaming(true);
    try {
      await api.renameWorkspace(workspace.id, editingName.trim());
      onRename(workspace.id, editingName.trim());
      setEditingName(null);
    } catch (err) {
      alert(err.message || '이름 변경에 실패했습니다.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div
      className={`ws-card ${isActive ? 'ws-card-active' : ''}`}
      onClick={editingName === null ? () => onSelect(workspace.id) : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={editingName === null ? (e) => e.key === 'Enter' && onSelect(workspace.id) : undefined}
    >
      {/* 옵션 메뉴 버튼 */}
      <button className="ws-card-menu-btn" onClick={handleMenuClick} title="옵션">
        ···
      </button>

      {menuOpen && (
        <>
          <div
            className="ws-card-menu-overlay"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
          />
          <div className="ws-card-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleRenameClick}>이름 수정</button>
            <button className="ws-card-menu-delete" onClick={handleDeleteClick}>삭제</button>
          </div>
        </>
      )}

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

      {/* 인라인 이름 수정 */}
      {editingName !== null && (
        <div className="ws-card-rename-panel" onClick={(e) => e.stopPropagation()}>
          <input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            autoFocus
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setEditingName(null);
            }}
          />
          <div className="ws-card-rename-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRenameSubmit}
              disabled={renaming}
            >
              {renaming ? '...' : '저장'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setEditingName(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
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

  const handleRename = (id, newName) => {
    setWorkspaces((prev) => prev.map((w) => w.id === id ? { ...w, name: newName } : w));
  };

  const handleDelete = (id) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
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
      <div className="ws-select-header">
        <h1 className="ws-select-app-name">Talkment</h1>
        <p className="ws-select-tagline">말로하는 관리 프로그램</p>
      </div>

      <h2 className="ws-select-title">작업 공간 선택</h2>

      {error && <div className="status-msg error" style={{ margin: '0 16px 12px' }}>{error}</div>}

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
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </div>
          ))
        )}
      </div>

      <div className="ws-add-section">
        <button className="ws-add-btn" onClick={onAddNew}>
          <span className="ws-add-icon">＋</span>
          <span>새 프로젝트 추가</span>
        </button>
      </div>
    </div>
  );
}
