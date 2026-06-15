import type { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { BrevoClient } from '@getbrevo/brevo';
import { Logger } from '@nestjs/common';

export type BrevoSendResult = {
  messageId: string;
};

export class BrevoEmailClient {
  private readonly logger = new Logger(BrevoEmailClient.name);
  private readonly client: BrevoClient;

  constructor(apiKey: string) {
    this.client = new BrevoClient({ apiKey });
  }

  async sendTransactionalEmail(
    options: SendEmailJobPayload,
    sender: { email: string; name: string },
  ): Promise<BrevoSendResult> {
    const recipient = this.describeRecipient(options.to);

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail({
        bcc: this.toRecipients(options.bcc),
        cc: this.toRecipients(options.cc),
        htmlContent: options.html,
        replyTo: options.replyTo ? { email: options.replyTo } : undefined,
        sender,
        subject: options.subject ?? '',
        textContent: options.text,
        to: this.toRecipients(options.to) ?? [],
      });

      const body =
        response && typeof response === 'object' && 'data' in response
          ? (response as { data?: { messageId?: string } }).data
          : (response as { messageId?: string });

      const messageId = body?.messageId ?? 'brevo-sent';
      this.logger.log(
        `Brevo accepted transactional email to ${recipient} (messageId=${messageId})`,
      );

      return { messageId };
    } catch (error) {
      this.logger.error(
        `Brevo rejected transactional email to ${recipient}: ${this.describeBrevoError(error)}`,
      );
      throw error;
    }
  }

  private describeRecipient(value: string | string[] | undefined): string {
    if (!value) {
      return 'unknown';
    }

    return Array.isArray(value) ? value.join(',') : value;
  }

  private describeBrevoError(error: unknown): string {
    if (error && typeof error === 'object') {
      const record = error as {
        message?: unknown;
        statusCode?: unknown;
        body?: unknown;
        response?: { body?: unknown; statusCode?: unknown };
      };

      const statusCode = record.statusCode ?? record.response?.statusCode;
      const body = record.body ?? record.response?.body;

      if (body !== undefined) {
        const serialized = typeof body === 'string' ? body : JSON.stringify(body);
        return [typeof statusCode === 'number' ? `status=${statusCode}` : null, serialized]
          .filter(Boolean)
          .join(' ');
      }

      if (typeof record.message === 'string') {
        return record.message;
      }
    }

    return error instanceof Error ? error.message : String(error);
  }

  private toRecipients(value: string | string[] | undefined): { email: string }[] | undefined {
    if (!value) {
      return undefined;
    }

    const items = Array.isArray(value) ? value : [value];
    const recipients = items
      .map((item) => item.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    return recipients.length > 0 ? recipients : undefined;
  }
}
