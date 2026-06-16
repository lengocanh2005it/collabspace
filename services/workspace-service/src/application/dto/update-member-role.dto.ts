import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
