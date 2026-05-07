// src/presentation/dtos/create-comment.request.ts
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray } from 'class-validator';

export class CreateCommentRequest {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsNotEmpty()
  authorId: string;

  @IsString()
  @IsNotEmpty()
  authorName: string;

  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  authorAvatarUrl?: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;
}
