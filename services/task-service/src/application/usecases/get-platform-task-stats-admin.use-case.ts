import { Inject, Injectable } from "@nestjs/common";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";

export type PlatformTaskStats = {
  total: number;
  byStatus: {
    TODO: number;
    DOING: number;
    DONE: number;
  };
};

@Injectable()
export class GetPlatformTaskStatsAdminUseCase {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(): Promise<PlatformTaskStats> {
    const byStatus = await this.taskRepository.countByStatusGrouped();
    const todo = byStatus.TODO ?? 0;
    const doing = byStatus.DOING ?? 0;
    const done = byStatus.DONE ?? 0;

    return {
      total: todo + doing + done,
      byStatus: { TODO: todo, DOING: doing, DONE: done },
    };
  }
}
