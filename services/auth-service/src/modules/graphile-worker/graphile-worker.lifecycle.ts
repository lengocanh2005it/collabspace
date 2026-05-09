import {
  GRAPHILE_WORKER_OPTIONS,
  GRAPHILE_WORKER_UTILS_TOKEN,
} from './graphile-worker.constants';
import type { GraphileWorkerModuleOptions } from './graphile-worker.types';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { run, type Runner, type WorkerUtils } from 'graphile-worker';

@Injectable()
export class GraphileWorkerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GraphileWorkerLifecycle.name);
  private runner: Runner | null = null;

  constructor(
    @Inject(GRAPHILE_WORKER_OPTIONS)
    private readonly options: GraphileWorkerModuleOptions,
    @Optional()
    @Inject(GRAPHILE_WORKER_UTILS_TOKEN)
    private readonly workerUtils: WorkerUtils | null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.disabled || !this.options.connectionString) {
      this.logger.log('Graphile worker is disabled. Skipping startup.');
      return;
    }

    this.runner = await run(
      this.getRunnerOptions(),
      this.options.taskList ?? {},
    );
    this.logger.log('Graphile worker started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.runner) {
      await this.runner.stop();
    }

    if (this.workerUtils) {
      await this.workerUtils.release();
    }
  }

  private getRunnerOptions(): GraphileWorkerModuleOptions {
    const {
      disabled: _disabled,
      taskList: _taskList,
      ...runnerOptions
    } = this.options;

    return runnerOptions;
  }
}
