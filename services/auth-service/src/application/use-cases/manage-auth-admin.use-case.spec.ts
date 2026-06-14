import { ManageAuthAdminUseCase } from './manage-auth-admin.use-case';
import type { AuthAdminRepository } from '@/domain/repositories/auth-admin.repository';
import type { RefreshTokenRepository } from '@/domain/repositories/refresh-token.repository';

describe('ManageAuthAdminUseCase', () => {
  const adminRepository = {
    assignRoleToUser: jest.fn(),
    setUserActive: jest.fn(),
  } as unknown as jest.Mocked<AuthAdminRepository>;
  const refreshTokenRepository = {
    revokeAllForUser: jest.fn(),
  } as unknown as jest.Mocked<RefreshTokenRepository>;
  const useCase = new ManageAuthAdminUseCase(
    adminRepository,
    refreshTokenRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('revokes sessions after assigning a role', async () => {
    adminRepository.assignRoleToUser.mockResolvedValue(undefined);

    await useCase.assignRole('admin-1', 'user-1', 'role-1');

    expect(adminRepository.assignRoleToUser).toHaveBeenCalledWith(
      'user-1',
      'role-1',
    );
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
