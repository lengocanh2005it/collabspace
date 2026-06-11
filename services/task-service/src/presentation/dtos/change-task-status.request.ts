// src/presentation/dtos/change-task-status.request.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsEnum, IsUUID, IsOptional } from "class-validator";

export class ChangeTaskStatusRequest {
  @ApiPropertyOptional({ format: "uuid", description: "Legacy field; task id is in URL" })
  @IsUUID()
  @IsOptional()
  public readonly taskId?: string;

  @ApiProperty({ enum: ["TODO", "DOING", "DONE"] })
  @IsString()
  @IsEnum(["TODO", "DOING", "DONE"], {
    message: "Status phải là TODO, DOING hoặc DONE",
  })
  @IsNotEmpty()
  public readonly status!: string;
}
