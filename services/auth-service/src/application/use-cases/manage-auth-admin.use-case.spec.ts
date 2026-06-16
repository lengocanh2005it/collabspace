import { ManageAuthAdminUseCase } from './manage-auth-admin.use-case';
import type { AuthAdminRepository } from '@/domain/repositories/auth-admin.repository';
import type { RefreshTokenRepository } from '@/domain/repositories/refresh-token.repository';

describe('ManageAuthAdminUseCase', () => {
  const adminRepository = {
    assignPermissionToRole: jest.fn(),
    assignRoleToUser: jest.fn(),
    createPermission: jest.fn(),
    createRole: jest.fn(),
    deleteRole: jest.fn(),
    listPermissions: jest.fn(),
    listRoles: jest.fn(),
    listUsers: jest.fn(),
    removePermissionFromRole: jest.fn(),
    setUserActive: jest.fn(),
    updateRole: jest.fn(),
  } as unknown as jest.Mocked<AuthAdminRepository>;
  const refreshTokenRepository = {
    revokeAllForUser: jest.fn(),
  } as unknown as jest.Mocked<RefreshTokenRepository>;
  const useCase = new ManageAuthAdminUseCase(adminRepository, refreshTokenRepository);

  beforeEach(() => jest.clearAllMocks());

  it('creates roles through the repository', async () => {
    adminRepository.createRole.mockResolvedValue({
      description: 'Support',
      id: 'role-1',
      name: 'support',
      permissions: [],
    });

    await expect(
      useCase.createRole({ description: 'Support', name: 'support' }),
    ).resolves.toMatchObject({ id: 'role-1' });
  });

  it('lists roles and permissions', async () => {
    adminRepository.listRoles.mockResolvedValue([]);
    adminRepository.listPermissions.mockResolvedValue([]);

    await useCase.listRoles();
    await useCase.listPermissions();

    expect(adminRepository.listRoles).toHaveBeenCalled();
    expect(adminRepository.listPermissions).toHaveBeenCalled();
  });

  it('unassigns permissions through the repository', async () => {
    adminRepository.removePermissionFromRole.mockResolvedValue({
      description: 'Support',
      id: 'role-1',
      name: 'support',
      permissions: [],
    });

    await expect(useCase.unassignPermission('role-1', 'perm-1')).resolves.toMatchObject({
      id: 'role-1',
      permissions: [],
    });
    expect(adminRepository.removePermissionFromRole).toHaveBeenCalledWith('role-1', 'perm-1');
  });

  it('revokes sessions after assigning a role', async () => {
    adminRepository.assignRoleToUser.mockResolvedValue(undefined);

    await useCase.assignRole('admin-1', 'user-1', 'role-1');

    expect(adminRepository.assignRoleToUser).toHaveBeenCalledWith('user-1', 'role-1');
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      'admin_role_changed',
    );
  });

  it('revokes sessions after disabling an account', async () => {
    adminRepository.setUserActive.mockResolvedValue(undefined);

    await useCase.setUserActive('admin-1', 'user-1', false);

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      'admin_account_disabled',
    );
  });
});
