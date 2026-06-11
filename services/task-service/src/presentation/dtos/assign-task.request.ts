// src/presentation/dtos/assign-task.request.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AssignTaskRequest {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Omit or null to unassign",
  })
  @IsOptional()
  @IsString()
  assigneeId?: string;
  // Cắt bỏ hoàn toàn assigneeName và assigneeAvatarUrl ở đây
}
