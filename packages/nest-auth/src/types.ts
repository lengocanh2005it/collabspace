import type { PlatformIdentity } from '@collabspace/shared';
import type { Request } from 'express';

export type AdminAuthenticatedRequest = Request & {
  adminIdentity: PlatformIdentity;
};

export interface PlatformIdentityResolver {
  resolve(request: Request): Promise<PlatformIdentity>;
}
