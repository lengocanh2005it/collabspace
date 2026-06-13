import { readRolesFromPayload } from './jwt-payload-roles.util';

describe('readRolesFromPayload', () => {
  it('reads roles array from payload', () => {
    expect(readRolesFromPayload({ roles: ['admin', 'user'] })).toEqual([
      'admin',
      'user',
    ]);
  });

  it('falls back to single role claim', () => {
    expect(readRolesFromPayload({ role: 'member' })).toEqual(['member']);
  });
});
