// src/presentation/dtos/update-task-details.request.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  IsDateString,
} from "class-validator";

export class UpdateTaskDetailsRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "Tên công việc không được để trống" })
  public readonly title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  public readonly description?: string;

  @ApiPropertyOptional({
    enum: ["LOW", "MEDIUM", "HIGH", "low", "medium", "high"],
  })
  @IsString()
  @IsOptional()
  @IsIn(["low", "medium", "high", "LOW", "MEDIUM", "HIGH"])
  public readonly priority?: string;

  @ApiPropertyOptional({ format: "date-time", nullable: true })
  @IsDateString()
  @IsOptional()
  public readonly dueDate?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public readonly labels?: string[];
}
