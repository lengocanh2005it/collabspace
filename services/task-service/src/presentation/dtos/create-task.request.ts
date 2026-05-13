// src/presentation/dtos/create-task.request.ts
import { IsString, IsNotEmpty, IsMongoId, IsOptional } from "class-validator";

export class CreateTaskRequest {
  @IsString()
  @IsNotEmpty({ message: "Tên công việc không được để trống" })
  public readonly title!: string;

  @IsString()
  @IsOptional()
  public readonly description?: string;

  @IsString()
  @IsNotEmpty({ message: "Workspace ID không được để trống" })
  public readonly workspaceId!: string;
}
