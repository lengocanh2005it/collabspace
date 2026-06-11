// src/presentation/dtos/update-task-details.request.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  IsDateString,
} from "class-validator";

export class UpdateTaskDetailsRequest {
  @IsString()
  @IsNotEmpty({ message: "Tên công việc không được để trống" })
  public readonly title!: string;

  @IsString()
  @IsOptional()
  public readonly description?: string;

  @IsString()
  @IsOptional()
  @IsIn(["low", "medium", "high", "LOW", "MEDIUM", "HIGH"])
  public readonly priority?: string;

  @IsDateString()
  @IsOptional()
  public readonly dueDate?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public readonly labels?: string[];
}
