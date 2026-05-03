// src/presentation/dtos/update-task-details.request.ts
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class UpdateTaskDetailsRequest {
  @IsUUID()
  @IsNotEmpty()
  public readonly taskId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên công việc không được để trống' })
  public readonly title!: string;

  @IsString()
  @IsOptional()
  public readonly description?: string;
}
