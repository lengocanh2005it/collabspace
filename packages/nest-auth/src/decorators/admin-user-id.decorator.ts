import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminAuthenticatedRequest } from '../types';

export const AdminUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    return request.adminIdentity.userId;
  },
);
