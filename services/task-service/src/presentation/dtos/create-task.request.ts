// src/presentation/dtos/create-task.request.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  IsDateString,
} from "class-validator";

export class CreateTaskRequest {
  @ApiProperty({ example: "Implement login screen" })
  @IsString()
  @IsNotEmpty({ message: "Tên công việc không được để trống" })
  public readonly title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  public readonly description?: string;

  @ApiProperty({ format: "uuid" })
  @IsString()
  @IsNotEmpty({ message: "Workspace ID không được để trống" })
  public readonly workspaceId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsString()
  @IsOptional()
  public readonly projectId?: string | null;

  @ApiPropertyOptional({
    enum: ["LOW", "MEDIUM", "HIGH", "low", "medium", "high"],
  })
  @IsString()
  @IsOptional()
  @IsIn(["low", "medium", "high", "LOW", "MEDIUM", "HIGH"])
  public readonly priority?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsDateString()
  @IsOptional()
  public readonly dueDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public readonly labels?: string[];
}
