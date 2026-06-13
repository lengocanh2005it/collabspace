import {
  SendEmailJobPayload,
  SendHtmlEmailInput,
  SendTextEmailInput,
} from '@/infrastructure/emails/email-job.types';
import {
  isOperationTimeoutError,
  withTimeout,
} from '@/common/utils/timeout.util';
import { ConfigurationService } from '@/configuration/configuration.service';
import { GraphileWorkerService } from '@/infrastructure/graphile-worker/graphile-worker.service';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import type { Job } from 'graphile-worker';
import { SentMessageInfo } from 'nodemailer';
import { EmailsSenderService } from './emails-sender.service';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

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
    try {
      return await withTimeout(
        this.emailsSenderService.send(options),
        this.getDeliveryTimeoutMs(),
        'Direct email delivery',
      );
    } catch (error) {
      this.rethrowDeliveryError(error);
    }
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

    try {
      return await withTimeout(
        this.graphileWorkerService.addJob('emails.send', options, {
          queueName: 'emails',
        }),
        this.getDeliveryTimeoutMs(),
        'Queued email delivery',
      );
    } catch (error) {
      this.rethrowDeliveryError(error);
    }
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

  private getDeliveryTimeoutMs(): number {
    return this.configurationService.getEmailConfig().deliveryTimeoutMs;
  }

  private rethrowDeliveryError(error: unknown): never {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    const timeoutMs = this.getDeliveryTimeoutMs();

    if (isOperationTimeoutError(error)) {
      this.logger.warn(`Email delivery timed out after ${timeoutMs}ms`);
      throw new ServiceUnavailableException({
        code: 'EMAIL_DELIVERY_TIMEOUT',
        message: `Email delivery timed out after ${timeoutMs}ms`,
      });
    }

    const message =
      error instanceof Error ? error.message : 'Email delivery failed';
    this.logger.warn(`Email delivery failed: ${message}`);
    throw new ServiceUnavailableException({
      code: 'EMAIL_DELIVERY_FAILED',
      message,
    });
  }
}
