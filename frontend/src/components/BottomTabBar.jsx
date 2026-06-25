const TABS = [
  { id: 'dashboard', icon: '📦', label: '재고현황' },
  { id: 'history',   icon: '📋', label: '반출이력' },
  { id: 'settings',  icon: '⚙️',  label: '설정' },
];

export default function BottomTabBar({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="bottom-tab-icon">{tab.icon}</span>
          <span className="bottom-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
