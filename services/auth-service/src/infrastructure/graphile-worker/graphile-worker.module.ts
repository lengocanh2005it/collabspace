import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsModule } from '@/infrastructure/emails/emails.module';
import { Module, forwardRef } from '@nestjs/common';
import { makeWorkerUtils } from 'graphile-worker';
import {
  GRAPHILE_WORKER_OPTIONS,
  GRAPHILE_WORKER_TASK_LIST,
  GRAPHILE_WORKER_UTILS_TOKEN,
} from './graphile-worker.constants';
import { GraphileWorkerLifecycle } from './graphile-worker.lifecycle';
import { GraphileWorkerService } from './graphile-worker.service';
import type { GraphileWorkerModuleOptions } from './graphile-worker.types';

@Module({
  imports: [forwardRef(() => EmailsModule)],
  providers: [
    {
      provide: GRAPHILE_WORKER_OPTIONS,
      inject: [ConfigurationService, GRAPHILE_WORKER_TASK_LIST],
      useFactory: (
        configurationService: ConfigurationService,
        taskList: GraphileWorkerModuleOptions['taskList'],
      ): GraphileWorkerModuleOptions => ({
        ...configurationService.getGraphileWorkerModuleOptions(),
        taskList,
      }),
    },
    {
      provide: GRAPHILE_WORKER_UTILS_TOKEN,
      inject: [GRAPHILE_WORKER_OPTIONS],
      useFactory: async (options: GraphileWorkerModuleOptions) => {
        if (options.disabled || !options.connectionString) {
          return null;
        }

        const { disabled: _disabled, taskList: _taskList, ...workerUtilsOptions } = options;

        return makeWorkerUtils(workerUtilsOptions);
      },
    },
    GraphileWorkerLifecycle,
    GraphileWorkerService,
  ],
  exports: [GraphileWorkerService],
})
export class GraphileWorkerModule {}
