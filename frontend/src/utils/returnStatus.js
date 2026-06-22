/** 시트 날짜 → YYYY-MM-DD */
export function parseSheetDate(value) {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** 출고된 적 있음 (재고 등록 행 제외) */
export function isCheckedOut(row) {
  return Boolean(String(row['출고일'] || '').trim() || String(row['출고자'] || '').trim());
}

/**
 * 미반납(연체): 반납예정일이 지났는데 반납일이 없음
 */
export function isOverdueUnreturned(row, today = new Date().toISOString().slice(0, 10)) {
  if (String(row['반납일'] || '').trim()) return false;
  const due = parseSheetDate(row['반납예정일']);
  if (!due || due >= today) return false;
  return isCheckedOut(row);
}

/** 대여 중 (반납 전, 기한 내) */
export function isOnLoan(row, today = new Date().toISOString().slice(0, 10)) {
  if (String(row['반납일'] || '').trim()) return false;
  if (!isCheckedOut(row)) return false;
  const due = parseSheetDate(row['반납예정일']);
  if (due && due < today) return false;
  return true;
}

export function getReturnStatusLabel(row, today = new Date().toISOString().slice(0, 10)) {
  if (String(row['반납일'] || '').trim()) return { text: '반납완료', warn: false };
  if (isOverdueUnreturned(row, today)) return { text: '미반납', warn: true };
  if (isOnLoan(row, today)) return { text: row['비고'] || row['상태'] || '대여중', warn: false };
  return { text: row['비고'] || '재고', warn: false };
}
