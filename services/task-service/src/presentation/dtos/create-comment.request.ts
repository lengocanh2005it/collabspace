// src/presentation/dtos/create-comment.request.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class CreateCommentRequest {
  @ApiProperty({ example: "Please review @username" })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsString()
  @IsOptional()
  parentId?: string;
}
