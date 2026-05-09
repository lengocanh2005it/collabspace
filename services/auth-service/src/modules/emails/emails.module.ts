import { GraphileWorkerModule } from '@/modules/graphile-worker/graphile-worker.module';
import { GRAPHILE_WORKER_TASK_LIST } from '@/modules/graphile-worker/graphile-worker.constants';
import { forwardRef, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsSenderService } from './emails-sender.service';
import { EmailsService } from './emails.service';

@Module({
  imports: [
    forwardRef(() => GraphileWorkerModule),
    MailerModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (configurationService: ConfigurationService) => {
        const emailConfig = configurationService.getEmailConfig();

        return {
          defaults: {
            from: emailConfig.from,
          },
          transport: emailConfig.url
            ? emailConfig.url
            : {
                auth:
                  emailConfig.user || emailConfig.password
                    ? {
                        pass: emailConfig.password,
                        user: emailConfig.user,
                      }
                    : undefined,
                host: emailConfig.host,
                ignoreTLS: emailConfig.ignoreTls,
                port: emailConfig.port,
                secure: emailConfig.secure,
              },
        };
      },
    }),
  ],
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
