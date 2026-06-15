import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return (request as any).user?.id as string;
});
