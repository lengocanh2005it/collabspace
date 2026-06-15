import { GRAPHILE_WORKER_UTILS_TOKEN } from './graphile-worker.constants';
import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DbJob, Job, TaskSpec, WorkerUtils } from 'graphile-worker';

@Injectable()
export class GraphileWorkerService {
  constructor(
    @Optional()
    @Inject(GRAPHILE_WORKER_UTILS_TOKEN)
    private readonly workerUtils: WorkerUtils | null,
  ) {}

  async addJob(taskIdentifier: string, payload: unknown, options?: TaskSpec): Promise<Job> {
    return this.getWorkerUtils().addJob(taskIdentifier, payload, {
      ...options,
      jobKey: options?.jobKey ?? randomUUID(),
    });
  }

  async schedule(taskIdentifier: string, payload: unknown, options?: TaskSpec): Promise<Job> {
    return this.addJob(taskIdentifier, payload, options);
  }

  async completeJobs(ids: string[]): Promise<DbJob[]> {
    return this.getWorkerUtils().completeJobs(ids);
  }

  async permanentlyFailJobs(ids: string[], reason?: string): Promise<DbJob[]> {
    return this.getWorkerUtils().permanentlyFailJobs(ids, reason);
  }

  async rescheduleJobs(
    ids: string[],
    options: {
      attempts?: number;
      maxAttempts?: number;
      priority?: number;
      runAt?: string | Date;
    },
  ): Promise<DbJob[]> {
    return this.getWorkerUtils().rescheduleJobs(ids, options);
  }

  async migrate(): Promise<void> {
    await this.getWorkerUtils().migrate();
  }

  private getWorkerUtils(): WorkerUtils {
    if (!this.workerUtils) {
      throw new ServiceUnavailableException({
        code: 'GRAPHILE_WORKER_DISABLED',
        message: 'Graphile worker is disabled',
      });
    }

    return this.workerUtils;
  }
}
