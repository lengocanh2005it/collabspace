export type ServiceAccessErrorCode =
  | 'INTERNAL_ACCESS_DENIED'
  | 'SERVICE_JWT_SCOPE_DENIED'
  | 'SERVICE_JWT_ISSUER_DENIED';

export class ServiceAccessDeniedError extends Error {
  readonly code: ServiceAccessErrorCode;

  constructor(code: ServiceAccessErrorCode, message: string) {
    super(message);
    this.name = 'ServiceAccessDeniedError';
    this.code = code;
  }
}
