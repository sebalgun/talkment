import { fetchSheetRows } from './googleSheets.js';
import { masterStore } from './masterDataStore.js';
import { getSpreadsheetId } from '../middleware/spreadsheetContext.js';
import { getSheetNames, getTabConfig } from './tabConfigService.js';
import {
  parseSerialLog,
  summarizeSerialAssets,
  summarizeConsumables,
} from './sheetParser.js';

function normalizeDate(raw) {
  if (!raw) return null;
  return String(raw).replace(/\./g, '-').trim().slice(0, 10);
}

function diffDaysFromToday(dueDateStr) {
  const due = new Date(normalizeDate(dueDateStr));
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((due - today) / 86400000);
}

export async function getDashboardStats() {
  const spreadsheetId = getSpreadsheetId();

  const SHEET_NAMES = getSheetNames();
  const tabCfg = getTabConfig();

  // masterStore returns already-parsed rows
  const [serialAssets, consumableAssets, rawSerialLog] = await Promise.all([
    masterStore.loadSerialAssets(spreadsheetId),
    masterStore.loadConsumableAssets(spreadsheetId),
    fetchSheetRows(SHEET_NAMES.SERIAL_LOG),   // 반납 현황은 항상 최신 데이터
  ]);
  const remappedLog = tabCfg.remap(rawSerialLog, 'serialLog');

  // 시리얼 자산 현황 요약
  const serialSummary = summarizeSerialAssets(serialAssets);

  // 시리얼 입출고 이력 — 미반납 항목 분류
  const log = parseSerialLog(remappedLog);
  const unreturned = log.filter((r) => !r._isReturned);

  const overdueItems = [];
  let overdue = 0;
  let dueToday = 0;
  let dueTomorrow = 0;

  for (const r of unreturned) {
    const rawDue = r['반납예정일'];
    if (!rawDue) continue;

    const diff = diffDaysFromToday(rawDue);
    if (diff < 0) {
      overdue++;
      overdueItems.push({
        no: r._no,
        itemName: r['항목'],
        serialNumber: r['시리얼 넘버'],
        employeeName: r['출고자'],
        department: r['소속'],
        returnDueDate: rawDue,
        daysOverdue: Math.abs(diff),
      });
    } else if (diff === 0) {
      dueToday++;
    } else if (diff === 1) {
      dueTomorrow++;
    }
  }

  // 소모품 현황 요약
  const consumableSummary = summarizeConsumables(consumableAssets);
  const totalRemaining = consumableSummary.reduce((s, c) => s + c.remaining, 0);

  return {
    serial: serialSummary,
    returns: {
      unreturned: unreturned.length,
      overdue,
      dueToday,
      dueTomorrow,
      overdueItems,
    },
    consumables: {
      totalRemaining,
      items: consumableSummary,
    },
    generatedAt: new Date().toISOString(),
  };
}
