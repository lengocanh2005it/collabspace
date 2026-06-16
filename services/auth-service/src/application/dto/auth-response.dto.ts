import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPendingResponseDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  email: string;

  @ApiProperty({ example: false })
  emailVerified: false;

  @ApiProperty({ example: 300 })
  otpExpiresInSeconds: number;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: true })
  verificationRequired: true;
}

export class VerifyEmailOtpResponseDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  email: string;

  @ApiProperty({ example: true })
  emailVerified: true;

  @ApiProperty({ example: true })
  verified: true;
}

export class ResendEmailVerificationOtpResponseDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  email: string;

  @ApiProperty({ example: false })
  emailVerified: false;

  @ApiProperty({ example: 300 })
  otpExpiresInSeconds: number;

  @ApiProperty({ example: true })
  resent: true;

  @ApiProperty({ format: 'uuid' })
  userId: string;
}

export class MeResponseDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  email: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiPropertyOptional({ example: 'Member Example' })
  fullName?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: ['users.read'], type: [String] })
  permissions: string[];

  @ApiPropertyOptional({
    enum: ['available', 'unavailable'],
    example: 'available',
  })
  profileStatus?: 'available' | 'unavailable';

  @ApiPropertyOptional({ example: 'user' })
  role?: string;

  @ApiProperty({ example: ['user'], type: [String] })
  roles: string[];

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ example: 'member.example' })
  username?: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  workspaceId?: string | null;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  changed: true;

  @ApiProperty({ example: 2 })
  revokedSessionCount: number;

  @ApiProperty({ format: 'uuid' })
  userId: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  revoked: true;
}

export class VerifyAccessResponseDto {
  @ApiProperty({ example: true })
  authenticated: true;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'Member Example' })
  fullName: string | null;

  @ApiProperty({ example: ['users.read'], type: [String] })
  permissions: string[];

  @ApiProperty({
    enum: ['available', 'unavailable'],
    example: 'available',
  })
  profileStatus: 'available' | 'unavailable';

  @ApiPropertyOptional({ nullable: true, example: 'user' })
  role: string | null;

  @ApiProperty({ example: ['user'], type: [String] })
  roles: string[];

  @ApiPropertyOptional({ nullable: true, example: 'member.example' })
  username: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  workspaceId: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'ok' })
  message: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'If the account exists, password reset instructions were sent.',
  })
  message: string;

  @ApiProperty({ example: true })
  sent: true;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 'Password reset successfully' })
  message: string;

  @ApiProperty({ example: true })
  reset: true;

  @ApiProperty({ example: 2 })
  revokedSessionCount: number;

  @ApiProperty({ format: 'uuid' })
  userId: string;
}

export class RefreshTokenSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  tokenId: string;

  @ApiProperty({ format: 'uuid' })
  familyId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  workspaceId: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastUsedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  revokedAt: string | null;
}

export class RevokeSessionResponseDto {
  @ApiProperty({ example: true })
  revoked: true;

  @ApiProperty({ format: 'uuid' })
  familyId: string;
}

export class LogoutOthersResponseDto {
  @ApiProperty({ example: true })
  revoked: true;

  @ApiProperty({ example: 1 })
  revokedSessionCount: number;
}

export class LogoutAllResponseDto {
  @ApiProperty({ example: true })
  revoked: true;

  @ApiProperty({ example: 2 })
  revokedSessionCount: number;
}
