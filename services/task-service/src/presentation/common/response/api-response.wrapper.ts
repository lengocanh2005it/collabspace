import { buildSuccess, buildError } from './response.helper';

export const ok = <T>(
  data: T,
  requestId?: string,
  meta?: Record<string, any>,
) => buildSuccess(data, requestId, meta);

export const created = <T>(
  data: T,
  requestId?: string,
  meta?: Record<string, any>,
) => buildSuccess(data, requestId, meta);

export const badRequest = (message: string, requestId?: string) =>
  buildError(message, requestId, 'BAD_REQUEST');

export const unauthorized = (message = 'Unauthorized', requestId?: string) =>
  buildError(message, requestId, 'UNAUTHORIZED');

export const notFound = (message = 'Resource not found', requestId?: string) =>
  buildError(message, requestId, 'NOT_FOUND');