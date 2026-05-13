// src/presentation/dtos/get-tasks.response.ts
import type { TaskResponseData } from "./task.response";

export class GetTasksResponse {
  public readonly tasks: TaskResponseData[];
  public readonly total: number;

  constructor(tasks: TaskResponseData[], total: number) {
    this.tasks = tasks;
    this.total = total;
  }
}
