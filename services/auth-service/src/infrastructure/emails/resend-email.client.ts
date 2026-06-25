import type { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { Logger } from '@nestjs/common';
import { Resend, type CreateEmailOptions } from 'resend';

export type ResendSendResult = {
  messageId: string;
};

export class ResendEmailClient {
  private readonly logger = new Logger(ResendEmailClient.name);
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async sendTransactionalEmail(
    options: SendEmailJobPayload,
    sender: { email: string; name: string },
  ): Promise<ResendSendResult> {
    const recipient = this.describeRecipient(options.to);
    const from = `${sender.name} <${sender.email}>`;

    const basePayload = {
      bcc: options.bcc,
      cc: options.cc,
      from,
      replyTo: options.replyTo,
      subject: options.subject ?? '',
      to: this.toRecipients(options.to),
    };
    const payload: CreateEmailOptions = options.html
      ? { ...basePayload, html: options.html, text: options.text }
      : { ...basePayload, text: options.text ?? '' };

    const { data, error } = await this.client.emails.send(payload);

    if (error) {
      this.logger.error(
        `Resend rejected transactional email to ${recipient}: ${error.name} - ${error.message}`,
      );
      throw new Error(`Resend error: ${error.message}`);
    }

    const messageId = data?.id ?? 'resend-sent';
    this.logger.log(`Resend accepted transactional email to ${recipient} (messageId=${messageId})`);

    return { messageId };
  }

  private describeRecipient(value: string | string[] | undefined): string {
    if (!value) {
      return 'unknown';
    }

    return Array.isArray(value) ? value.join(',') : value;
  }

  private toRecipients(value: string | string[] | undefined): string | string[] {
    if (!value) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter(Boolean);
    }

    return value.trim();
  }
}
