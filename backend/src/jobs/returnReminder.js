import dotenv from 'dotenv';
dotenv.config();

import { fetchSheetRowsById } from '../services/googleSheets.js';
import { getSheetNames, getTabConfig } from '../services/tabConfigService.js';
import { masterStore } from '../services/masterDataStore.js';
import { getAppConfig } from '../services/appConfigStore.js';
import { getActiveWorkspace } from '../services/onboardingStore.js';
import {
  sendReturnReminder,
  sendDueTodayAlert,
  sendOverdueAlert,
} from '../services/emailService.js';

// ─── 날짜 유틸 ──────────────────────────────────────────────

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function normalizeDate(raw) {
  if (!raw) return null;
  return String(raw).replace(/\./g, '-').trim().slice(0, 10);
}

function diffDays(dueDateStr) {
  const due = new Date(normalizeDate(dueDateStr));
  const today = new Date(dateStr());
  return Math.round((due - today) / 86400000);
}

// ─── 직원 이메일 추출 ────────────────────────────────────────

function extractEmail(row) {
  return (
    row['이메일'] ||
    row['이메일주소'] ||
    row['이메일 주소'] ||
    ''
  ).trim();
}

// ─── 메인 실행 ───────────────────────────────────────────────

export async function runReturnReminder() {
  const cfg = getAppConfig();
  const spreadsheetId = cfg.sheet?.spreadsheetId;
  if (!spreadsheetId) {
    console.warn('[Reminder] 스프레드시트 미설정 — 건너뜀');
    return { DUE_TOMORROW: 0, DUE_TODAY: 0, OVERDUE: 0, skipped: 0 };
  }

  const workspace = getActiveWorkspace();
  const employeesId = workspace?.sheets?.employees?.spreadsheetId || spreadsheetId;

  const SHEET_NAMES = getSheetNames();
  const tabCfg = getTabConfig();

  const [employees, rawSerialRows] = await Promise.all([
    masterStore.loadEmployees(employeesId),
    fetchSheetRowsById(spreadsheetId, SHEET_NAMES.SERIAL_LOG),
  ]);
  const serialRows = tabCfg.remap(rawSerialRows, 'serialLog');

  const empMap = Object.fromEntries(employees.map((e) => [e['이름'], e]));

  const unreturned = serialRows.filter((r) => !String(r['반납일'] || '').trim());

  const stats = { DUE_TOMORROW: 0, DUE_TODAY: 0, OVERDUE: 0, skipped: 0 };

  for (const row of unreturned) {
    const rawDue = row['반납예정일'];
    if (!rawDue) {
      stats.skipped++;
      continue;
    }

    const email = extractEmail(row);
    if (!email) {
      stats.skipped++;
      continue;
    }

    const diff = diffDays(rawDue);
    const emp = empMap[row['출고자']] || {};
    const params = {
      to: email,
      employeeName: row['출고자'] || '',
      title: row['직함'] || emp['직함'] || '',
      department: row['소속'] || emp['소속'] || '',
      itemName: row['항목'] || '',
      itemDetail: row['시리얼 넘버'] || '',
      returnDueDate: rawDue,
    };

    try {
      if (diff === 1) {
        await sendReturnReminder(params);
        stats.DUE_TOMORROW++;
        console.log(`[Reminder] D-1: ${params.employeeName} — ${params.itemName}`);
      } else if (diff === 0) {
        await sendDueTodayAlert(params);
        stats.DUE_TODAY++;
        console.log(`[Reminder] D-0: ${params.employeeName} — ${params.itemName}`);
      } else if (diff < 0) {
        await sendOverdueAlert({ ...params, daysOverdue: Math.abs(diff) });
        stats.OVERDUE++;
        console.log(`[Reminder] 연체 ${Math.abs(diff)}일: ${params.employeeName} — ${params.itemName}`);
      } else {
        stats.skipped++;
      }
    } catch (e) {
      console.error(`[Reminder] 발송 실패 (${email}):`, e.message);
      stats.skipped++;
    }
  }

  console.log(
    `[Reminder] 완료 — D-1: ${stats.DUE_TOMORROW}, D-0: ${stats.DUE_TODAY}, ` +
    `연체: ${stats.OVERDUE}, 건너뜀: ${stats.skipped}`
  );
  return stats;
}

if (process.argv[1]?.includes('returnReminder')) {
  runReturnReminder()
    .then((r) => { console.log(r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
