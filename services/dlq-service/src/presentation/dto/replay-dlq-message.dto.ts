import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReplayDlqMessageDto {
  @ApiPropertyOptional({ description: 'Optional note for audit trail' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
