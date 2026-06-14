import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from './platform-admin.guard';
import { REQUIRE_PERMISSION_KEY } from '../constants';
import type { PlatformIdentityResolver } from '../types';

describe('PlatformAdminGuard', () => {
  const reflector = new Reflector();
  const resolver: PlatformIdentityResolver = {
    resolve: jest.fn(),
  };
  const guard = new PlatformAdminGuard(reflector, resolver);

  const createContext = (handler: object, request: object) =>
    ({
      getClass: () => handler,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as never;

  beforeEach(() => jest.clearAllMocks());

  it('allows platform admins by default', async () => {
    (resolver.resolve as jest.Mock).mockResolvedValue({
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-1',
    });
    const request = {};

    await expect(
      guard.canActivate(createContext({}, request)),
    ).resolves.toBe(true);
    expect(request).toMatchObject({
      adminIdentity: { userId: 'admin-1' },
    });
  });

  it('rejects members for platform admin routes', async () => {
    (resolver.resolve as jest.Mock).mockResolvedValue({
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
    });

    await expect(
      guard.canActivate(createContext({}, {})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows explicit permissions when RequirePermission is set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === REQUIRE_PERMISSION_KEY) {
        return ['users.read'];
      }
      return false;
    });
    (resolver.resolve as jest.Mock).mockResolvedValue({
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
    });

    await expect(
      guard.canActivate(createContext({}, {})),
    ).resolves.toBe(true);
  });
});
