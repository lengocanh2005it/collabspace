import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';

describe('UsersController directory access', () => {
  const controller = Object.create(UsersController.prototype) as UsersController;

  it('requires a search query for non-admin users', () => {
    expect(() =>
      (controller as any).assertDirectoryAccess(
        { role: 'member', roles: ['member'], userId: 'user-1' },
        undefined,
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows platform admins to browse without a query', () => {
    expect(() =>
      (controller as any).assertDirectoryAccess(
        { role: 'admin', roles: ['admin'], userId: 'admin-1' },
        undefined,
      ),
    ).not.toThrow();
  });
});
