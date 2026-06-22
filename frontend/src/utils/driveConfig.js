const STORE_KEY = 'inventory_drive_folder_id';

/** Drive 폴더 URL 또는 ID에서 폴더 ID 추출 */
export function parseDriveFolderId(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;

  return null;
}

export function getDriveFolderId() {
  return localStorage.getItem(STORE_KEY) || '';
}

export function setDriveFolderId(folderId) {
  if (folderId) localStorage.setItem(STORE_KEY, folderId);
  else localStorage.removeItem(STORE_KEY);
}

export function isDriveConfigured() {
  return Boolean(getDriveFolderId());
}
