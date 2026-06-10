// src/presentation/dtos/create-task.response.ts
export class CreateTaskResponse {
  public readonly success: boolean;
  public readonly message: string;
  public readonly data: {
    taskId: string;
  };

  constructor(taskId: string) {
    this.success = true;
    this.message = "Tạo công việc thành công";
    this.data = { taskId };
  }
}
