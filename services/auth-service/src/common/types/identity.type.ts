export type AuthUser = {
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  permissions: string[];
  role?: string;
  roles: string[];
  userId: string;
};

export type RegisterInput = {
  email: string;
  fullName: string;
  password: string;
  roleNames?: string[];
  workspaceId?: string;
};

export type RegisterPendingResult = {
  email: string;
  emailVerified: false;
  otpExpiresInSeconds: number;
  userId: string;
  verificationRequired: true;
};

export type LoginInput = {
  email: string;
  password: string;
  workspaceId?: string;
};

export type VerifyEmailOtpInput = {
  otp: string;
  userId: string;
};

export type ResendEmailVerificationOtpInput = {
  userId: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
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
