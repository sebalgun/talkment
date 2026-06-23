/**
 * Replit Database 클라이언트
 * REPLIT_DB_URL 환경변수가 있을 때만 동작 (로컬 개발 시 무시)
 */

const DB_URL = process.env.REPLIT_DB_URL;

export const isAvailable = () => Boolean(DB_URL);

export async function get(key) {
  if (!DB_URL) return null;
  try {
    const res = await fetch(`${DB_URL}/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function set(key, value) {
  if (!DB_URL) return;
  try {
    const body = new URLSearchParams({ [key]: JSON.stringify(value) });
    await fetch(DB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    // best effort — 실패해도 파일 저장은 이미 완료됨
  }
}
