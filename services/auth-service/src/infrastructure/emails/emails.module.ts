import { GraphileWorkerModule } from '@/infrastructure/graphile-worker/graphile-worker.module';
import { GRAPHILE_WORKER_TASK_LIST } from '@/infrastructure/graphile-worker/graphile-worker.constants';
import { forwardRef, Module } from '@nestjs/common';
import { EmailsSenderService } from './emails-sender.service';
import { EmailsService } from './emails.service';

@Module({
  imports: [forwardRef(() => GraphileWorkerModule)],
  providers: [
    EmailsSenderService,
    EmailsService,
    {
      provide: GRAPHILE_WORKER_TASK_LIST,
      inject: [EmailsSenderService],
      useFactory: (emailsSenderService: EmailsSenderService) => ({
        'emails.send': async (payload: unknown) => {
          await emailsSenderService.send(payload as never);
        },
      }),
    },
  ],
  exports: [EmailsService, EmailsSenderService, GRAPHILE_WORKER_TASK_LIST],
})
export class EmailsModule {}
