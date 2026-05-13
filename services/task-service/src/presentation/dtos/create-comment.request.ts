// src/presentation/dtos/create-comment.request.ts
import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class CreateCommentRequest {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}
