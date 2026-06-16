import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ForceJoinWorkspaceDto {
  @ApiProperty({ example: 'Investigating an abuse report' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @ApiProperty({ enum: ['member'], default: 'member' })
  @IsIn(['member'])
  role = 'member' as const;
}
