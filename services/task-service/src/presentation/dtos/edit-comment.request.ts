// src/presentation/dtos/edit-comment.request.ts
import { IsString, MaxLength, MinLength } from "class-validator";

export class EditCommentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
