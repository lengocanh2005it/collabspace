import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUTH_ADMIN_REPOSITORY,
  type AuthAdminRepository,
} from '@/domain/repositories/auth-admin.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';

@Injectable()
export class ManageAuthAdminUseCase {
  private readonly logger = new Logger(ManageAuthAdminUseCase.name);

  constructor(
    @Inject(AUTH_ADMIN_REPOSITORY)
    private readonly adminRepository: AuthAdminRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  createRole(input: { description: string; name: string }) {
    return this.adminRepository.createRole(input);
  }

  createPermission(input: { description: string; name: string }) {
    return this.adminRepository.createPermission(input);
  }

  assignPermission(roleId: string, permissionId: string) {
    return this.adminRepository.assignPermissionToRole(roleId, permissionId);
  }

  unassignPermission(roleId: string, permissionId: string) {
    return this.adminRepository.removePermissionFromRole(roleId, permissionId);
  }

  async assignRole(actorId: string, userId: string, roleId: string) {
    const result = await this.adminRepository.assignRoleToUser(userId, roleId);
    await this.refreshTokenRepository.revokeAllForUser(userId, 'admin_role_changed');
    this.logger.log(
      `admin_action=assign_role actorId=${actorId} userId=${userId} roleId=${roleId}`,
    );
    return result;
  }

  listRoles() {
    return this.adminRepository.listRoles();
  }

  listPermissions() {
    return this.adminRepository.listPermissions();
  }

  listUsers() {
    return this.adminRepository.listUsers();
  }

  updateRole(roleId: string, input: { description?: string; name?: string }) {
    return this.adminRepository.updateRole(roleId, input);
  }

  deleteRole(roleId: string) {
    return this.adminRepository.deleteRole(roleId);
  }

  async setUserActive(actorId: string, userId: string, isActive: boolean) {
    const result = await this.adminRepository.setUserActive(userId, isActive);
    await this.refreshTokenRepository.revokeAllForUser(
      userId,
      isActive ? 'admin_account_reactivated' : 'admin_account_disabled',
    );
    this.logger.log(
      `admin_action=set_active actorId=${actorId} userId=${userId} isActive=${isActive}`,
    );
    return result;
  }
}
