import { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { BrevoClient } from '@getbrevo/brevo';

export type BrevoSendResult = {
  messageId: string;
};

export class BrevoEmailClient {
  private readonly client: BrevoClient;

  constructor(apiKey: string) {
    this.client = new BrevoClient({ apiKey });
  }

  async sendTransactionalEmail(
    options: SendEmailJobPayload,
    sender: { email: string; name: string },
  ): Promise<BrevoSendResult> {
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

    return {
      messageId: body?.messageId ?? 'brevo-sent',
    };
  }

  private toRecipients(
    value: string | string[] | undefined,
  ): { email: string }[] | undefined {
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
