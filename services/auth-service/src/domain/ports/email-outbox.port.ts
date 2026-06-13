export const EMAIL_OUTBOX = Symbol('EMAIL_OUTBOX');

export type EmailVerificationOtpEnqueuePayload = {
  email: string;
  otp: string;
  otpTtlSeconds: number;
  userId: string;
};

export type EmailOutboxStats = {
  failedCount: number;
  oldestFailedAt: string | null;
  oldestPendingAt: string | null;
  pendingCount: number;
  processedCount: number;
  processingCount: number;
  staleProcessingCount: number;
};

export interface EmailOutbox {
  enqueueEmailVerificationOtp(
    payload: EmailVerificationOtpEnqueuePayload,
  ): Promise<void>;
  getStats(): Promise<EmailOutboxStats>;
}
