export type RegisterPendingResult = {
  email: string;
  emailVerified: false;
  otpExpiresInSeconds: number;
  userId: string;
  verificationRequired: true;
};

export type ChangePasswordResult = {
  changed: true;
  revokedSessionCount: number;
  userId: string;
};

export type VerifyEmailOtpResult = {
  email: string;
  emailVerified: true;
  verified: true;
};

export type ResendEmailVerificationOtpResult = {
  email: string;
  emailVerified: false;
  otpExpiresInSeconds: number;
  resent: true;
  userId: string;
};

export type ForgotPasswordResult = {
  message: string;
  sent: true;
};

export type ResetPasswordResult = {
  message: string;
  reset: true;
  revokedSessionCount: number;
  userId: string;
};

export type AuthSessionSummaryResult = {
  tokenId: string;
  familyId: string;
  userId: string;
  workspaceId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
};

export type RevokeSessionResult = {
  revoked: true;
  familyId: string;
};

export type LogoutOthersResult = {
  revoked: true;
  revokedSessionCount: number;
};

export type LogoutAllResult = {
  revoked: true;
  revokedSessionCount: number;
};
