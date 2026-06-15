import { GraphileWorkerModule } from '@/infrastructure/graphile-worker/graphile-worker.module';
import { GRAPHILE_WORKER_TASK_LIST } from '@/infrastructure/graphile-worker/graphile-worker.constants';
import { forwardRef, Logger, Module } from '@nestjs/common';
import { EmailsSenderService } from './emails-sender.service';
import { EmailsService } from './emails.service';
import type { SendEmailJobPayload } from './email-job.types';

@Module({
  imports: [forwardRef(() => GraphileWorkerModule)],
  providers: [
    EmailsSenderService,
    EmailsService,
    {
      provide: GRAPHILE_WORKER_TASK_LIST,
      inject: [EmailsSenderService],
      useFactory: (emailsSenderService: EmailsSenderService) => {
        const logger = new Logger('GraphileEmailsSendTask');

        return {
          'emails.send': async (payload: unknown) => {
            const job = payload as SendEmailJobPayload;
            const recipient = Array.isArray(job.to)
              ? job.to.join(',')
              : (job.to ?? 'unknown');

            logger.log(
              `Processing emails.send job to=${recipient} subject="${job.subject ?? ''}"`,
            );

            try {
              const result = await emailsSenderService.send(job);
              logger.log(
                `Completed emails.send job to=${recipient} messageId=${result.messageId}`,
              );
            } catch (error) {
              logger.error(
                `Failed emails.send job to=${recipient}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              throw error;
            }
          },
        };
      },
    },
  ],
  exports: [EmailsService, EmailsSenderService, GRAPHILE_WORKER_TASK_LIST],
})
export class EmailsModule {}
