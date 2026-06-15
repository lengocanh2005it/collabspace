// src/application/usecases/get-task-activity.handler.ts
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTaskActivityQuery } from "../queries/get-task-activity.query";
import {
  ITaskActivityRepository as ITaskActivityRepositoryToken,
  type ITaskActivityRepository,
} from "../ports/ITaskActivityRepository";
import { TaskActivityResponse } from "../../presentation/dtos/task-activity.response";

@QueryHandler(GetTaskActivityQuery)
export class GetTaskActivityHandler implements IQueryHandler<GetTaskActivityQuery> {
  constructor(
    @Inject(ITaskActivityRepositoryToken)
    private readonly taskActivityRepository: ITaskActivityRepository,
  ) {}

  async execute(query: GetTaskActivityQuery): Promise<TaskActivityResponse> {
    const [items, total] = await Promise.all([
      this.taskActivityRepository.findByTaskIdAsync(query.taskId, {
        offset: query.offset,
        limit: query.limit,
      }),
      this.taskActivityRepository.countByTaskIdAsync(query.taskId),
    ]);

    return new TaskActivityResponse(items, total);
  }
}
