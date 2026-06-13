import { SendEmailJobPayload } from '@/common/types/email.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { SentMessageInfo } from 'nodemailer';

@Injectable()
export class EmailsSenderService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configurationService: ConfigurationService,
  ) {}

  async send(options: SendEmailJobPayload): Promise<SentMessageInfo> {
    console.log('\n--- MOCK EMAIL SENDER ---');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('Body:', options.text || options.html);
    console.log('-------------------------\n');
    return {} as any;
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

  private getDefaultFrom(): string {
    return this.configurationService.getEmailConfig().from;
  }
}
