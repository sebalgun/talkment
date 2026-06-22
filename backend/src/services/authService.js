import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { getGoogleAuth } from './googleSheets.js';
import { getAppConfig } from './appConfigStore.js';

const oauthClient = new OAuth2Client(config.google.clientId);

export async function verifyGoogleToken(idToken) {
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('유효하지 않은 Google 토큰입니다.');
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: payload.email_verified,
  };
}

export async function checkSpreadsheetAccess(userEmail, spreadsheetId) {
  const drive = google.drive({ version: 'v3', auth: getGoogleAuth() });
  try {
    const res = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: 'permissions(emailAddress,role,type,domain)',
      pageSize: 100,
    });
    const perms = res.data.permissions || [];
    const email = userEmail.toLowerCase();
    const domain = email.split('@')[1];
    return perms.some((p) => {
      if (p.type === 'user' && p.emailAddress?.toLowerCase() === email) return true;
      if (p.type === 'domain' && domain && p.domain?.toLowerCase() === domain) return true;
      return false;
    });
  } catch (e) {
    console.warn('[Auth] Drive 권한 조회 실패 (접근 거부):', e.message);
    return false;
  }
}

export function issueJwt(user) {
  return jwt.sign(user, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export async function authenticateUser(idToken) {
  const user = await verifyGoogleToken(idToken);

  // 스프레드시트 미설정 시(초기 셋업) → 조건 없이 허용
  const cfg = getAppConfig();
  if (!cfg.sheet?.spreadsheetId) {
    return { token: issueJwt(user), user };
  }

  const hasAccess = await checkSpreadsheetAccess(user.email, cfg.sheet.spreadsheetId);
  if (!hasAccess) {
    const err = new Error(
      '이 스프레드시트에 접근 권한이 없습니다. 스프레드시트를 공유받았는지 확인해 주세요.'
    );
    err.status = 403;
    throw err;
  }

  return { token: issueJwt(user), user };
}
