import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function resolveBackendPath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.resolve(backendRoot, p);
}

export { SHEET_NAMES } from '../constants/sheetNames.js';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  google: {
    serviceAccountPath: resolveBackendPath(
      process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './credentials/service-account.json'
    ),
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    driveSignatureFolderId: process.env.GOOGLE_DRIVE_SIGNATURE_FOLDER_ID,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  },
  reminderCron: process.env.REMINDER_CRON || '0 9 * * *',
};
