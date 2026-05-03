// src/presentation/dtos/assign-task.request.ts
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class AssignTaskRequest {
  @IsUUID()
  @IsNotEmpty()
  public readonly taskId!: string;

  @IsString()
  @IsOptional()
  public readonly assigneeId?: string;

  @IsString()
  @IsOptional()
  public readonly assigneeName?: string;

  @IsString()
  @IsOptional()
  public readonly assigneeAvatarUrl?: string;
}
