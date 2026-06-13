import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsString()
  workspaceId?: string;
}

export class RefreshSessionRequestDto {
  @ApiProperty({ example: 'refresh-token-uuid' })
  @IsString()
  refreshToken: string;
}

export class LogoutRequestDto {
  @ApiProperty({ example: 'refresh-token-uuid' })
  @IsString()
  refreshToken: string;
}

export class VerifyEmailOtpRequestDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;

  @ApiProperty({ format: 'uuid' })
  @IsString()
  userId: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({ example: 'newpassword456' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
