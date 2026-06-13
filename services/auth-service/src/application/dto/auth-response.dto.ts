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

  @ApiPropertyOptional({ example: 'member' })
  role?: string;

  @ApiProperty({ example: ['member'], type: [String] })
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

  @ApiPropertyOptional({ nullable: true, example: 'member' })
  role: string | null;

  @ApiProperty({ example: ['member'], type: [String] })
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
