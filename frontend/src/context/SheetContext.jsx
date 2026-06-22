import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getActiveSheet,
  registerSheet,
  removeSheet,
  isSheetConfigured,
} from '../utils/sheetConfig';
import { getDriveFolderId, setDriveFolderId } from '../utils/driveConfig';
import { INVENTORY_MODES } from '../constants/inventoryModes';
import { api } from '../api/client';

const SheetContext = createContext(null);

async function pushLocalConfigToServer() {
  const sheet = getActiveSheet();
  if (!sheet?.spreadsheetId) return;
  await api.saveAppConfig({
    sheet: {
      spreadsheetId: sheet.spreadsheetId,
      url: sheet.url,
      title: sheet.title,
      alias: sheet.alias,
    },
    driveFolderId: getDriveFolderId() || undefined,
  });
}

export function SheetProvider({ children }) {
  const [internalSheet, setInternalSheet] = useState(() => getActiveSheet());
  const [version, setVersion] = useState(0);
  const [bootstrapped, setBootstrapped] = useState(false);

  const refresh = useCallback(() => {
    setInternalSheet(getActiveSheet());
    setVersion((v) => v + 1);
  }, []);

  const registerSheetForMode = useCallback(async (_mode, payload) => {
    const entry = registerSheet(INVENTORY_MODES.INTERNAL, payload);
    await api.saveAppConfig({
      sheet: {
        spreadsheetId: entry.spreadsheetId,
        url: entry.url,
        title: entry.title,
        alias: entry.alias,
      },
      driveFolderId: getDriveFolderId() || undefined,
    });
    refresh();
    return entry;
  }, [refresh]);

  const deleteSheetForMode = useCallback(async (_mode) => {
    removeSheet(INVENTORY_MODES.INTERNAL);
    try {
      await api.saveAppConfig({ sheet: null });
    } catch {
      /* ignore */
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (isSheetConfigured()) {
          await pushLocalConfigToServer();
        } else {
          const cfg = await api.getAppConfig();
          if (cfg.sheet?.spreadsheetId) {
            registerSheet(INVENTORY_MODES.INTERNAL, cfg.sheet);
          }
          if (cfg.driveFolderId && !getDriveFolderId()) {
            setDriveFolderId(cfg.driveFolderId);
          }
        }
      } catch {
        /* 서버 미연결 시 로컬 설정만 사용 */
      }

      if (!cancelled) {
        refresh();
        setBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <SheetContext.Provider
      value={{
        activeMode: INVENTORY_MODES.INTERNAL,
        activeSheet: internalSheet,
        internalSheet,
        version,
        bootstrapped,
        hasSheets: isSheetConfigured(),
        isInternalConfigured: isSheetConfigured(),
        registerSheetForMode,
        deleteSheetForMode,
        refresh,
        syncConfigToServer: pushLocalConfigToServer,
      }}
    >
      {children}
    </SheetContext.Provider>
  );
}

export function useSheet() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet must be used within SheetProvider');
  return ctx;
}

export { isSheetConfigured };
