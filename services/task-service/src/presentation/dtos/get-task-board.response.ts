import type { TaskResponseData } from "./task.response";

export interface TaskBoardColumn {
  status: string;
  tasks: TaskResponseData[];
}

export class GetTaskBoardResponse {
  constructor(
    public readonly workspaceId: string,
    public readonly columns: TaskBoardColumn[],
    public readonly total: number,
  ) {}
}
