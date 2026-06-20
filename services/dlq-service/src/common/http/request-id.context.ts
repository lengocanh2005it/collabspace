import { AsyncLocalStorage } from 'node:async_hooks';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-Id';

type RequestIdStore = { requestId: string };

export const requestIdStorage = new AsyncLocalStorage<RequestIdStore>();

export function getRequestId(): string | undefined {
  return requestIdStorage.getStore()?.requestId;
}

export function outboundRequestIdHeaders(): Record<string, string> {
  const requestId = getRequestId();
  return requestId ? { [REQUEST_ID_RESPONSE_HEADER]: requestId } : {};
}
