import type { JwtPayload } from '@/domain/types/jwt';
import { readFirstString } from './jwt-payload.util';

export function readRolesFromPayload(payload: JwtPayload): string[] {
  if (Array.isArray(payload.roles)) {
    return payload.roles.filter(
      (role): role is string => typeof role === 'string' && role.length > 0,
    );
  }

  if (typeof payload.roles === 'string' && payload.roles.length > 0) {
    return [payload.roles];
  }

  const role = readFirstString(payload.role);
  return role ? [role] : [];
}
