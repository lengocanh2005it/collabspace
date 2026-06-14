import type { Request } from 'express';

export type AuthenticatedUser = {
  emailVerified?: boolean;
  id: string;
  role?: string;
  roles: string[];
  userId: string;
  workspaceId?: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
