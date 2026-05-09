import {
  SendEmailJobPayload,
  SendHtmlEmailInput,
  SendTextEmailInput,
} from '@/common/types/email.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { GraphileWorkerService } from '@/modules/graphile-worker/graphile-worker.service';
import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import type { Job } from 'graphile-worker';
import { SentMessageInfo } from 'nodemailer';
import { EmailsSenderService } from './emails-sender.service';

@Injectable()
export class EmailsService {
  constructor(
    private readonly emailsSenderService: EmailsSenderService,
    private readonly configurationService: ConfigurationService,
    @Optional()
    @Inject(forwardRef(() => GraphileWorkerService))
    private readonly graphileWorkerService: GraphileWorkerService | null,
  ) {}

  async sendHtml(input: SendHtmlEmailInput): Promise<Job | SentMessageInfo> {
    return this.sendMail({
      bcc: input.bcc,
      cc: input.cc,
      from: input.from,
      html: input.html,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      to: input.to,
    });
  }

  async sendMail(options: SendEmailJobPayload): Promise<Job | SentMessageInfo> {
    const normalizedOptions = this.normalizeOptions(options);

    if (this.shouldQueueEmails()) {
      return this.queueMail(normalizedOptions);
    }

    return this.sendMailNow(normalizedOptions);
  }

  async sendMailNow(options: SendEmailJobPayload): Promise<SentMessageInfo> {
    return this.emailsSenderService.send(options);
  }

  async sendText(input: SendTextEmailInput): Promise<Job | SentMessageInfo> {
    return this.sendMail({
      bcc: input.bcc,
      cc: input.cc,
      from: input.from,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      to: input.to,
    });
  }

  private normalizeOptions(options: SendEmailJobPayload): SendEmailJobPayload {
    return this.emailsSenderService.normalizeOptions(options);
  }

  private async queueMail(options: SendEmailJobPayload): Promise<Job> {
    if (!this.graphileWorkerService) {
      throw new ServiceUnavailableException({
        code: 'GRAPHILE_WORKER_UNAVAILABLE',
        message: 'Graphile worker service is not available',
      });
    }

    return this.graphileWorkerService.addJob('emails.send', options, {
      queueName: 'emails',
    });
  }

  private shouldQueueEmails(): boolean {
    const graphileWorkerConfig =
      this.configurationService.getGraphileWorkerConfig();

    return (
      graphileWorkerConfig.enabled &&
      !!graphileWorkerConfig.connectionString &&
      !!this.graphileWorkerService
    );
  }
}
