import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { runReturnReminder } from './jobs/returnReminder.js';
import { spreadsheetMiddleware, parseSpreadsheetId } from './middleware/spreadsheetContext.js';
import { getAppConfig, restoreFromDb as restoreAppConfig } from './services/appConfigStore.js';
import { getActiveWorkspace, restoreFromDb as restoreWorkspaces } from './services/onboardingStore.js';
import { masterStore } from './services/masterDataStore.js';

import sheetsRouter from './routes/sheets.js';
import employeesRouter from './routes/employees.js';
import assetsRouter from './routes/assets.js';
import consumablesRouter from './routes/consumables.js';
import voiceRouter from './routes/voice.js';
import checkoutRouter from './routes/checkout.js';
import returnsRouter from './routes/returns.js';
import signatureRouter from './routes/signature.js';
import configRouter from './routes/config.js';
import onboardingRouter from './routes/onboarding.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { SIGNATURES_DIR } from './services/localSignatureStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── 공개 엔드포인트 (JWT 불필요) ──────────────────────────────────────────────

// 서명 이미지 — 인증 없이 공개 (Google Sheets =IMAGE() 접근용)
mkdirSync(SIGNATURES_DIR, { recursive: true });
app.use('/signatures', express.static(SIGNATURES_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** 앱 초기 설정용 공개 정보 (서비스 계정 이메일, Google 클라이언트 ID 등) */
app.get('/api/config/public', (_req, res) => {
  try {
    let serviceAccountEmail = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      serviceAccountEmail = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email || null;
    } else {
      const keyPath = config.google.serviceAccountPath;
      if (keyPath && existsSync(keyPath)) {
        serviceAccountEmail = JSON.parse(readFileSync(keyPath, 'utf-8')).client_email || null;
      }
    }
    res.json({
      serviceAccountEmail,
      googleClientId: config.google.clientId || null,
    });
  } catch {
    res.json({ serviceAccountEmail: null, googleClientId: null });
  }
});

/** Google 로그인 검증 — JWT 발급 */
app.use('/api/auth', authRouter);

/** 시트 ID URL 파싱 — 온보딩 중 사용 */
app.post('/api/sheets/parse-id', (req, res) => {
  const spreadsheetId = parseSpreadsheetId(req.body?.url);
  if (!spreadsheetId) {
    return res.status(400).json({ error: '올바른 구글 스프레드시트 URL 또는 ID가 아닙니다.' });
  }
  res.json({ spreadsheetId });
});

// ── 인증 게이트 (이하 모든 API는 유효한 JWT 필요) ────────────────────────────
app.use('/api', authMiddleware);

/** 앱 설정 — 시트 등록 (spreadsheetMiddleware 이전에 등록) */
app.use('/api/app-config', configRouter);

/** 온보딩 — 최초 실행 감지 및 작업 공간 등록 */
app.use('/api/onboarding', onboardingRouter);

/** 이하 API는 X-Spreadsheet-Id 헤더 또는 .env GOOGLE_SPREADSHEET_ID 필요 */
app.use('/api', spreadsheetMiddleware);

app.use('/api/sheets', sheetsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/consumables', consumablesRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/signature', signatureRouter);
app.use('/api/dashboard', dashboardRouter);

/** 등록되지 않은 API 경로 — SPA index.html로 떨어지지 않게 */
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API 경로를 찾을 수 없습니다.' });
});

/** 빌드된 프론트엔드 서빙 — 단일 서버로 앱+API 동시 제공 */
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Cloud Run 콜드스타트: Replit DB에서 설정 파일 복원 후 서버 시작
await Promise.all([restoreAppConfig(), restoreWorkspaces()]);

app.listen(config.port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i?.family === 'IPv4' && !i.internal)?.address;
  console.log(`서버 실행: http://localhost:${config.port}`);
  if (lan) console.log(`휴대폰 접속: http://${lan}:${config.port}`);
  if (existsSync(frontendDist)) console.log('(앱+API 단일 서버 모드)');
  console.log('[AppConfig] 시트 등록 저장 위치: backend/data/app-config.json');

  // 설정된 스프레드시트가 있으면 마스터 데이터 미리 로드
  const cfg = getAppConfig();
  if (cfg.sheet?.spreadsheetId) {
    const workspace = getActiveWorkspace();
    const employeesId =
      workspace?.sheets?.employees?.spreadsheetId || cfg.sheet.spreadsheetId;

    masterStore
      .preloadAll(cfg.sheet.spreadsheetId, employeesId)
      .then(({ employees, serialAssets, consumableAssets }) => {
        console.log(
          `[MasterStore] 초기 로드 완료 — ` +
          `직원 ${employees.length}명 / ` +
          `시리얼 ${serialAssets.length}개 / ` +
          `소모품 ${consumableAssets.length}개`
        );
      })
      .catch((e) => {
        console.warn('[MasterStore] 초기 로드 실패 (첫 요청 시 재시도):', e.message);
      });
  }
});

if (config.reminderCron) {
  cron.schedule(config.reminderCron, () => {
    console.log('[Cron] 반납 안내 메일 배치 실행');
    runReturnReminder().catch(console.error);
  });
  console.log(`[Cron] 스케줄 등록: ${config.reminderCron}`);
}
