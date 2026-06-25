import { EmailsService } from '@/infrastructure/emails/emails.service';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
} from '../database/entities/auth-outbox-event.orm-entity';

export type AuthOutboxPublishHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Strategy registry: maps auth outbox event types to publish handlers.
 */
export class AuthOutboxPublishRegistry {
  private readonly handlers = new Map<string, AuthOutboxPublishHandler>();

  constructor(emailsService: EmailsService) {
    this.handlers.set(AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP, async (payload) => {
      const otp = String(payload.otp);
      const ttlSeconds = Number(payload.otpTtlSeconds);
      const recipientName = normalizeRecipientName(payload.recipientName);
      await emailsService.sendMailNow({
        subject: 'Xác minh email CollabSpace của bạn',
        html: buildEmailVerificationHtml(otp, ttlSeconds, recipientName),
        text: buildEmailVerificationText(otp, ttlSeconds, recipientName),
        to: String(payload.email),
      });
    });

    this.handlers.set(AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL, async (payload) => {
      const token = String(payload.token);
      const ttlSeconds = Number(payload.ttlSeconds);
      const recipientName = normalizeRecipientName(payload.recipientName);
      await emailsService.sendMailNow({
        subject: 'Đặt lại mật khẩu CollabSpace',
        html: buildPasswordResetHtml(token, ttlSeconds, recipientName),
        text: buildPasswordResetText(token, ttlSeconds, recipientName),
        to: String(payload.email),
      });
    });
  }

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      throw new Error(`Unsupported auth outbox event type: ${eventType}`);
    }
    await handler(payload);
  }
}

function buildEmailVerificationText(
  otp: string,
  ttlSeconds: number,
  recipientName?: string,
): string {
  const greeting = buildGreeting(recipientName);

  return [
    greeting,
    '',
    `Mã xác minh CollabSpace của bạn là: ${otp}`,
    `Mã này hết hạn sau ${ttlSeconds} giây.`,
    '',
    'Nếu bạn không tạo tài khoản CollabSpace, bạn có thể bỏ qua email này.',
    '',
    'CollabSpace',
  ].join('\n');
}

function buildPasswordResetText(token: string, ttlSeconds: number, recipientName?: string): string {
  const greeting = buildGreeting(recipientName);

  return [
    greeting,
    '',
    `Mã đặt lại mật khẩu CollabSpace của bạn là: ${token}`,
    `Mã này hết hạn sau ${ttlSeconds} giây.`,
    '',
    'Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.',
    '',
    'CollabSpace',
  ].join('\n');
}

function buildEmailVerificationHtml(
  otp: string,
  ttlSeconds: number,
  recipientName?: string,
): string {
  const greeting = buildGreeting(recipientName);

  return buildTransactionalEmailHtml({
    body: [
      `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:24px;">${escapeHtml(greeting)}</p>`,
      '<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:24px;">Sử dụng mã này để xác minh địa chỉ email CollabSpace của bạn.</p>',
      `<div style="margin:24px 0;padding:18px 20px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;text-align:center;font-size:28px;font-weight:700;letter-spacing:4px;color:#0f172a;">${escapeHtml(otp)}</div>`,
      `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Mã này hết hạn sau ${ttlSeconds} giây.</p>`,
      '<p style="margin:0;color:#64748b;font-size:13px;line-height:20px;">Nếu bạn không tạo tài khoản CollabSpace, bạn có thể bỏ qua email này.</p>',
    ].join(''),
    preview: `Mã xác minh CollabSpace của bạn là ${otp}`,
    title: 'Xác minh email của bạn',
  });
}

function buildPasswordResetHtml(token: string, ttlSeconds: number, recipientName?: string): string {
  const greeting = buildGreeting(recipientName);

  return buildTransactionalEmailHtml({
    body: [
      `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:24px;">${escapeHtml(greeting)}</p>`,
      '<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:24px;">Sử dụng mã này để đặt lại mật khẩu CollabSpace của bạn.</p>',
      `<div style="margin:24px 0;padding:18px 20px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;text-align:center;font-size:18px;font-weight:700;color:#0f172a;word-break:break-all;">${escapeHtml(token)}</div>`,
      `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Mã này hết hạn sau ${ttlSeconds} giây.</p>`,
      '<p style="margin:0;color:#64748b;font-size:13px;line-height:20px;">Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.</p>',
    ].join(''),
    preview: 'Mã đặt lại mật khẩu CollabSpace của bạn',
    title: 'Đặt lại mật khẩu',
  });
}

function buildTransactionalEmailHtml(input: {
  body: string;
  preview: string;
  title: string;
}): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(input.title)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">',
    `<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(input.preview)}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">',
    '<tr><td style="padding:0 0 18px;font-size:20px;font-weight:700;color:#0f172a;">CollabSpace</td></tr>',
    `<tr><td style="padding:0 0 14px;font-size:24px;font-weight:700;color:#0f172a;">${escapeHtml(input.title)}</td></tr>`,
    `<tr><td>${input.body}</td></tr>`,
    '<tr><td style="padding-top:28px;color:#94a3b8;font-size:12px;line-height:18px;">Đây là email bảo mật tự động từ CollabSpace.</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');
}

function buildGreeting(recipientName: string | undefined): string {
  return recipientName ? `Chào ${recipientName},` : 'Chào bạn,';
}

function normalizeRecipientName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
