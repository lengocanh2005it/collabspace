// src/presentation/dtos/get-tasks.response.ts
import type { TaskResponseData } from "./task.response";

export class GetTasksResponse {
  public readonly tasks: TaskResponseData[];
  public readonly total: number;
  public readonly skip: number;
  public readonly limit: number;

  constructor(tasks: TaskResponseData[], total: number, skip: number, limit: number) {
    this.tasks = tasks;
    this.total = total;
    this.skip = skip;
    this.limit = limit;
  }
}
