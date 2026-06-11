import { AsyncLocalStorage } from 'node:async_hooks';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-Id';

type RequestIdStore = { requestId: string };

export const requestIdStorage = new AsyncLocalStorage<RequestIdStore>();

export function getRequestId(): string | undefined {
  return requestIdStorage.getStore()?.requestId;
}

export function getRequestIdFromRequest(request: {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}): string | undefined {
  if (request.requestId) {
    return request.requestId;
  }

  const raw = request.headers[REQUEST_ID_HEADER];

  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }

  if (Array.isArray(raw) && raw[0]?.trim()) {
    return raw[0].trim();
  }

  return undefined;
}

export function outboundRequestIdHeaders(): Record<string, string> {
  const requestId = getRequestId();

  return requestId ? { [REQUEST_ID_RESPONSE_HEADER]: requestId } : {};
}
