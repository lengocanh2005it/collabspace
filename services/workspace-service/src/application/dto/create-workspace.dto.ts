import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ maxLength: 100, example: 'CollabSpace Demo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Team workspace for MVP sprint' })
  @IsString()
  @IsOptional()
  description?: string;
}
