import { BadRequestException } from '@nestjs/common';

export function isPlatformAdminAccount(roles: string[], permissions: string[]): boolean {
  return roles.includes('admin') || permissions.includes('auth.manage');
}

export function assertCollaborationUserForInvitation(roles: string[], permissions: string[]): void {
  if (isPlatformAdminAccount(roles, permissions)) {
    throw new BadRequestException({
      code: 'PLATFORM_ADMIN_CANNOT_JOIN_WORKSPACE',
      message: 'Platform admin accounts cannot join workspaces via invitations.',
    });
  }
}
