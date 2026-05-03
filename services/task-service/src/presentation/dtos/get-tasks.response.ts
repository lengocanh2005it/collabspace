// src/presentation/dtos/get-tasks.response.ts
import { TaskResponse } from './task.response';

export class GetTasksResponse {
  public readonly tasks: TaskResponse[];
  public readonly total: number;

  constructor(tasks: TaskResponse[], total: number) {
    this.tasks = tasks;
    this.total = total;
  }
}
