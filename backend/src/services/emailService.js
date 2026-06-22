import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

// ─── HTML 이메일 빌더 ────────────────────────────────────────

function buildHtml({ badgeColor, badgeText, headline, bodyLines, footerNote }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">

        <!-- 헤더 -->
        <tr><td style="background:#2563eb;padding:20px 28px">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Talkment 재고관리</p>
        </td></tr>

        <!-- 배지 + 제목 -->
        <tr><td style="padding:28px 28px 0">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${badgeColor};color:#fff;font-size:12px;font-weight:700">${badgeText}</span>
          <p style="margin:12px 0 0;font-size:20px;font-weight:700;color:#1e293b">${headline}</p>
        </td></tr>

        <!-- 본문 항목 -->
        <tr><td style="padding:20px 28px">
          <table width="100%" style="border-collapse:collapse">
            ${bodyLines.map(({ label, value }) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:110px">${label}</td>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;font-weight:600">${value}</td>
            </tr>`).join('')}
          </table>
        </td></tr>

        <!-- 안내 문구 -->
        <tr><td style="padding:0 28px 28px">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">${footerNote}</p>
        </td></tr>

        <!-- 푸터 -->
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#94a3b8">이 메일은 Talkment 재고관리 시스템에서 자동 발송되었습니다.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(lines) {
  return lines.map(({ label, value }) => `${label}: ${value}`).join('\n');
}

// ─── 공통 발송 헬퍼 ──────────────────────────────────────────

async function send({ to, subject, html, text }) {
  await getTransporter().sendMail({ from: config.smtp.from, to, subject, html, text });
}

// ─── 알림 유형별 발송 함수 ──────────────────────────────────

/**
 * D-1 알림: 내일 반납 예정
 */
export async function sendReturnReminder({
  to, employeeName, title, department, itemName, itemDetail, returnDueDate,
}) {
  const bodyLines = [
    { label: '수신자', value: `${employeeName} ${title} (${department})` },
    { label: '대여 물품', value: `${itemName} (${itemDetail})` },
    { label: '반납 예정일', value: returnDueDate },
  ];

  await send({
    to,
    subject: '[Talkment] 내일 반납 예정 안내',
    html: buildHtml({
      badgeColor: '#f59e0b',
      badgeText: 'D-1 알림',
      headline: '내일이 반납 예정일입니다',
      bodyLines,
      footerNote: '내일까지 관리자에게 방문하여 반납 처리해 주시기 바랍니다.',
    }),
    text: `[D-1 반납 안내]\n${buildText(bodyLines)}\n내일까지 반납 처리 부탁드립니다.`,
  });
}

/**
 * D-0 알림: 오늘 반납 예정
 */
export async function sendDueTodayAlert({
  to, employeeName, title, department, itemName, itemDetail, returnDueDate,
}) {
  const bodyLines = [
    { label: '수신자', value: `${employeeName} ${title} (${department})` },
    { label: '대여 물품', value: `${itemName} (${itemDetail})` },
    { label: '반납 예정일', value: returnDueDate },
  ];

  await send({
    to,
    subject: '[Talkment] 오늘 반납 예정 안내',
    html: buildHtml({
      badgeColor: '#2563eb',
      badgeText: 'D-DAY',
      headline: '오늘이 반납 예정일입니다',
      bodyLines,
      footerNote: '오늘 중으로 관리자에게 방문하여 반납 처리해 주시기 바랍니다.',
    }),
    text: `[D-DAY 반납 안내]\n${buildText(bodyLines)}\n오늘 반납 처리 부탁드립니다.`,
  });
}

/**
 * 반납 지연 알림: 반납예정일이 이미 지남
 */
export async function sendOverdueAlert({
  to, employeeName, title, department, itemName, itemDetail, returnDueDate, daysOverdue,
}) {
  const bodyLines = [
    { label: '수신자', value: `${employeeName} ${title} (${department})` },
    { label: '대여 물품', value: `${itemName} (${itemDetail})` },
    { label: '반납 예정일', value: returnDueDate },
    { label: '지연 일수', value: `${daysOverdue}일 초과` },
  ];

  await send({
    to,
    subject: `[Talkment] 반납 ${daysOverdue}일 지연 — 즉시 반납 요청`,
    html: buildHtml({
      badgeColor: '#dc2626',
      badgeText: `${daysOverdue}일 지연`,
      headline: '반납이 지연되고 있습니다',
      bodyLines,
      footerNote: '반납 예정일이 지났습니다. 즉시 관리자에게 연락하거나 방문하여 반납 처리해 주시기 바랍니다.',
    }),
    text: `[반납 지연 안내]\n${buildText(bodyLines)}\n즉시 반납 처리 부탁드립니다.`,
  });
}
