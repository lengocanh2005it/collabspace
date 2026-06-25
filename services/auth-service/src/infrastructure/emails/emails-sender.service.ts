import type { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { ConfigurationService } from '@/configuration/configuration.service';
import { ResendEmailClient } from '@/infrastructure/emails/resend-email.client';
import { isNodeProduction } from '@collabspace/shared';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export type EmailSendResult = {
  accepted: string[];
  messageId: string;
};

@Injectable()
export class EmailsSenderService {
  private readonly logger = new Logger(EmailsSenderService.name);
  private resendClient: ResendEmailClient | null = null;

  constructor(private readonly configurationService: ConfigurationService) {}

  async send(options: SendEmailJobPayload): Promise<EmailSendResult> {
    const normalized = this.normalizeOptions(options);

    if (!this.isResendConfigured()) {
      if (isNodeProduction()) {
        throw new ServiceUnavailableException({
          code: 'EMAIL_DELIVERY_UNAVAILABLE',
          message: 'Resend email delivery is not configured (RESEND_API_KEY missing)',
        });
      }

      this.logger.log(
        `Mock email (RESEND_API_KEY not set) -> ${normalized.to}: ${normalized.subject}`,
      );
      return {
        accepted: [String(normalized.to)],
        messageId: 'mock',
      };
    }

    const resendConfig = this.configurationService.getResendConfig();
    const client = this.getResendClient();
    const result = await client.sendTransactionalEmail(normalized, {
      email: resendConfig.senderEmail,
      name: resendConfig.senderName,
    });

    return {
      accepted: [String(normalized.to)],
      messageId: result.messageId,
    };
  }

  normalizeOptions(options: SendEmailJobPayload): SendEmailJobPayload {
    const resendConfig = this.configurationService.getResendConfig();
    const defaultFrom = resendConfig.senderEmail
      ? `${resendConfig.senderName} <${resendConfig.senderEmail}>`
      : 'no-reply@collabspace.local';

    return {
      bcc: options.bcc,
      cc: options.cc,
      from: options.from ?? defaultFrom,
      html: options.html,
      replyTo: options.replyTo,
      subject: options.subject ?? '',
      text: options.text,
      to: options.to ?? '',
    };
  }

  private isResendConfigured(): boolean {
    return Boolean(this.configurationService.getResendConfig().apiKey);
  }

  private getResendClient(): ResendEmailClient {
    const apiKey = this.configurationService.getResendConfig().apiKey;
    if (!apiKey) {
      throw new Error('Resend API key is not configured');
    }

    if (!this.resendClient) {
      this.resendClient = new ResendEmailClient(apiKey);
    }

    return this.resendClient;
  }
}
