import { ASSIGNABLE_WORKSPACE_ROLES, type AssignableWorkspaceRole } from '@collabspace/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_WORKSPACE_ROLES })
  @IsIn(ASSIGNABLE_WORKSPACE_ROLES)
  role: AssignableWorkspaceRole;
}
