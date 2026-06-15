import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTaskBoardQuery } from "../queries/get-task-board.query";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { buildTaskListFilter, TASK_BOARD_DEFAULT_LIMIT } from "../ports/task-list-filter";
import { TaskMapper } from "../../infrastructure/mappers/task.mapper";
import {
  GetTaskBoardResponse,
  type TaskBoardColumn,
} from "../../presentation/dtos/get-task-board.response";

const BOARD_STATUSES = ["TODO", "DOING", "DONE"] as const;

@QueryHandler(GetTaskBoardQuery)
export class GetTaskBoardHandler implements IQueryHandler<GetTaskBoardQuery> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTaskBoardQuery): Promise<GetTaskBoardResponse> {
    const filter = buildTaskListFilter({ projectId: query.projectId });
    const tasks = await this.taskRepository.findByWorkspaceIdAsync(query.workspaceId, filter, {
      limit: TASK_BOARD_DEFAULT_LIMIT,
    });

    const columns: TaskBoardColumn[] = BOARD_STATUSES.map((status) => ({
      status,
      tasks: tasks
        .filter((task) => task.getStatus().getValue() === status)
        .map((task) => TaskMapper.toResponse(task)),
    }));

    const total = columns.reduce((sum, column) => sum + column.tasks.length, 0);

    return new GetTaskBoardResponse(query.workspaceId, columns, total);
  }
}
