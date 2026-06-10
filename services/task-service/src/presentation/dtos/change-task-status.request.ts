// src/presentation/dtos/change-task-status.request.ts
import { IsString, IsNotEmpty, IsEnum, IsUUID } from "class-validator";

export class ChangeTaskStatusRequest {
  @IsUUID()
  @IsNotEmpty()
  public readonly taskId!: string;

  @IsString()
  @IsEnum(["TODO", "DOING", "DONE"], {
    message: "Status phải là TODO, DOING hoặc DONE",
  })
  @IsNotEmpty()
  public readonly status!: string;
}
