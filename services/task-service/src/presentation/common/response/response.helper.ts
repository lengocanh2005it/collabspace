export function baseMeta(requestId?: string) {
  return {
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function buildSuccess<T>(
  data: T,
  requestId?: string,
  extraMeta?: Record<string, any>,
) {
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
) {
  return {
    success: false,
    error: message,
    meta: {
      ...baseMeta(requestId),
      ...(errorCode && { errorCode }),
    },
  };
}