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
