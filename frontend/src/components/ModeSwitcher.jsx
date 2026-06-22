import { useSheet } from '../context/SheetContext';
import { INVENTORY_MODES, MODE_LABELS } from '../constants/inventoryModes';

export default function ModeSwitcher({ onManage }) {
  const {
    activeMode,
    switchMode,
    internalSheet,
    externalSheet,
    isInternalConfigured,
    isExternalConfigured,
  } = useSheet();

  const handleSwitch = (mode) => {
    if (mode === activeMode) return;
    if (mode === INVENTORY_MODES.INTERNAL && !isInternalConfigured) return;
    if (mode === INVENTORY_MODES.EXTERNAL && !isExternalConfigured) return;
    switchMode(mode);
  };

  const activeSheet =
    activeMode === INVENTORY_MODES.EXTERNAL ? externalSheet : internalSheet;

  return (
    <div className="mode-switcher">
      <div className="mode-switcher-tabs">
        <button
          type="button"
          className={`mode-tab ${activeMode === INVENTORY_MODES.INTERNAL ? 'active' : ''}`}
          onClick={() => handleSwitch(INVENTORY_MODES.INTERNAL)}
          disabled={!isInternalConfigured}
        >
          {MODE_LABELS.internal}
        </button>
        <button
          type="button"
          className={`mode-tab ${activeMode === INVENTORY_MODES.EXTERNAL ? 'active' : ''}`}
          onClick={() => handleSwitch(INVENTORY_MODES.EXTERNAL)}
          disabled={!isExternalConfigured}
        >
          {MODE_LABELS.external}
        </button>
      </div>
      {activeSheet && (
        <button type="button" className="mode-sheet-link" onClick={onManage} title="시트 관리">
          📂 {activeSheet.alias}
        </button>
      )}
    </div>
  );
}
