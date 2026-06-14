import type { ApiResponse } from "./api-response.interface";

export function baseMeta(requestId?: string) {
  return {
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function buildSuccess<T>(
  data: T,
  requestId?: string,
  extraMeta?: Record<string, unknown>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      ...baseMeta(requestId),
      ...extraMeta,
    },
  };
}

export function buildError(
  message: string,
  requestId?: string,
  errorCode?: string,
): ApiResponse<never> {
  return {
    success: false,
    error: message,
    meta: {
      ...baseMeta(requestId),
      ...(errorCode && { errorCode }),
    },
  };
}
