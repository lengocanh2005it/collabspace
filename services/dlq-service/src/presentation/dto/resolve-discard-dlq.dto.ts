import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveDiscardDlqDto {
  @ApiPropertyOptional({
    description: 'Optional note explaining the resolution decision',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}
