// src/presentation/dtos/assign-task.request.ts
import { IsOptional, IsString } from 'class-validator';

export class AssignTaskRequest {
  @IsOptional()
  @IsString()
  assigneeId?: string;
  // Cắt bỏ hoàn toàn assigneeName và assigneeAvatarUrl ở đây
}