import { SendEmailJobPayload } from '@/infrastructure/emails/email-job.types';
import { ConfigurationService } from '@/configuration/configuration.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { SentMessageInfo } from 'nodemailer';

@Injectable()
export class EmailsSenderService {
  private readonly logger = new Logger(EmailsSenderService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configurationService: ConfigurationService,
  ) {}

  async send(options: SendEmailJobPayload): Promise<SentMessageInfo> {
    const normalized = this.normalizeOptions(options);

    if (!this.isSmtpConfigured()) {
      this.logger.log(
        `Mock email (MAIL_USER/MAIL_PASSWORD not set) → ${normalized.to}: ${normalized.subject}`,
      );
      return { accepted: [normalized.to], messageId: 'mock' } as SentMessageInfo;
    }

    return this.mailerService.sendMail({
      bcc: normalized.bcc,
      cc: normalized.cc,
      from: normalized.from,
      html: normalized.html,
      replyTo: normalized.replyTo,
      subject: normalized.subject,
      text: normalized.text,
      to: normalized.to,
    });
  }

  normalizeOptions(options: SendEmailJobPayload): SendEmailJobPayload {
    return {
      bcc: options.bcc,
      cc: options.cc,
      from: options.from ?? this.getDefaultFrom(),
      html: options.html,
      replyTo: options.replyTo,
      subject: options.subject ?? '',
      text: options.text,
      to: options.to ?? '',
    };
  }

  private isSmtpConfigured(): boolean {
    const { user, password, url } = this.configurationService.getEmailConfig();
    return Boolean(url || (user && password));
  }

  private getDefaultFrom(): string {
    return this.configurationService.getEmailConfig().from;
  }
}
