// src/presentation/dtos/create-task.request.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  IsDateString,
} from "class-validator";

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

  @IsString()
  @IsOptional()
  public readonly projectId?: string;

  @IsString()
  @IsOptional()
  @IsIn(["low", "medium", "high", "LOW", "MEDIUM", "HIGH"])
  public readonly priority?: string;

  @IsDateString()
  @IsOptional()
  public readonly dueDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public readonly labels?: string[];
}
