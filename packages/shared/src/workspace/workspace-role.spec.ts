import { meetsWorkspaceRole, normalizeWorkspaceRole, parseWorkspaceRole } from './workspace-role';

describe('workspace role contract', () => {
  describe('meetsWorkspaceRole', () => {
    it('orders owner > manager > member', () => {
      expect(meetsWorkspaceRole('owner', 'member')).toBe(true);
      expect(meetsWorkspaceRole('owner', 'manager')).toBe(true);
      expect(meetsWorkspaceRole('manager', 'member')).toBe(true);
      expect(meetsWorkspaceRole('manager', 'owner')).toBe(false);
      expect(meetsWorkspaceRole('member', 'manager')).toBe(false);
    });

    it('returns false for null role', () => {
      expect(meetsWorkspaceRole(null, 'member')).toBe(false);
    });
  });

  describe('parseWorkspaceRole', () => {
    it('accepts owner, manager, member', () => {
      expect(parseWorkspaceRole('manager')).toBe('manager');
    });

    it('maps legacy admin to member', () => {
      expect(parseWorkspaceRole('admin')).toBe('member');
    });

    it('returns null for unknown values', () => {
      expect(parseWorkspaceRole('superuser')).toBeNull();
    });
  });

  describe('normalizeWorkspaceRole', () => {
    it('defaults unknown roles to member', () => {
      expect(normalizeWorkspaceRole('admin')).toBe('member');
      expect(normalizeWorkspaceRole('bogus')).toBe('member');
    });
  });
});
