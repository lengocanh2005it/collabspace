import { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { ConfigurationService } from '@/configuration/configuration.service';
import { BrevoEmailClient } from '@/infrastructure/emails/brevo-email.client';
import { Injectable, Logger } from '@nestjs/common';

export type EmailSendResult = {
  accepted: string[];
  messageId: string;
};

@Injectable()
export class EmailsSenderService {
  private readonly logger = new Logger(EmailsSenderService.name);
  private brevoClient: BrevoEmailClient | null = null;

  constructor(private readonly configurationService: ConfigurationService) {}

  async send(options: SendEmailJobPayload): Promise<EmailSendResult> {
    const normalized = this.normalizeOptions(options);

    if (!this.isBrevoConfigured()) {
      this.logger.log(
        `Mock email (BREVO_API_KEY not set) → ${normalized.to}: ${normalized.subject}`,
      );
      return {
        accepted: [String(normalized.to)],
        messageId: 'mock',
      };
    }

    const brevoConfig = this.configurationService.getBrevoConfig();
    const client = this.getBrevoClient();
    const result = await client.sendTransactionalEmail(normalized, {
      email: brevoConfig.senderEmail,
      name: brevoConfig.senderName,
    });

    return {
      accepted: [String(normalized.to)],
      messageId: result.messageId,
    };
  }

  normalizeOptions(options: SendEmailJobPayload): SendEmailJobPayload {
    const brevoConfig = this.configurationService.getBrevoConfig();
    const defaultFrom = brevoConfig.senderEmail
      ? `${brevoConfig.senderName} <${brevoConfig.senderEmail}>`
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

  private isBrevoConfigured(): boolean {
    return Boolean(this.configurationService.getBrevoConfig().apiKey);
  }

  private getBrevoClient(): BrevoEmailClient {
    const apiKey = this.configurationService.getBrevoConfig().apiKey;
    if (!apiKey) {
      throw new Error('Brevo API key is not configured');
    }

    if (!this.brevoClient) {
      this.brevoClient = new BrevoEmailClient(apiKey);
    }

    return this.brevoClient;
  }
}
