import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  VerifyEmailOtpRequestDto,
} from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { ChangePasswordUseCase } from '@/application/use-cases/change-password.use-case';
import { GetCurrentUserUseCase } from '@/application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '@/application/use-cases/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '@/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import { ResendEmailVerificationOtpUseCase } from '@/application/use-cases/resend-email-verification-otp.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';
import { VerifyEmailOtpUseCase } from '@/application/use-cases/verify-email-otp.use-case';
import { JwtTokenService } from '@/application/services/jwt-token.service';
import {
  AuthUser,
  RegisterInput,
  RegisterPendingResult,
  ResendEmailVerificationOtpInput,
  ResendEmailVerificationOtpResult,
  VerifyEmailOtpResult,
  ChangePasswordResult,
} from '@/common/types/identity.type';
import { AuthIdentity, SignAccessTokenInput } from '@/common/types/jwt.type';
import { Injectable } from '@nestjs/common';

/**
 * Thin facade kept for e2e/tests and gradual migration. Controllers use use cases directly.
 * Remove in Phase 4.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly verifyAccessTokenUseCase: VerifyAccessTokenUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly resendEmailVerificationOtpUseCase: ResendEmailVerificationOtpUseCase,
    private readonly verifyEmailOtpUseCase: VerifyEmailOtpUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  async getCurrentUser(authorizationHeader?: string): Promise<
    AuthUser & {
      fullName?: string;
      username?: string;
      profileStatus?: 'available' | 'unavailable';
      workspaceId?: string | null;
    }
  > {
    return this.getCurrentUserUseCase.execute(authorizationHeader);
  }

  async login(input: LoginRequestDto): Promise<AuthSessionResponseDto> {
    return this.loginUseCase.execute(input);
  }

  async logout(input: LogoutRequestDto): Promise<{ revoked: true }> {
    return this.logoutUseCase.execute(input);
  }

  async refresh(input: RefreshSessionRequestDto): Promise<AuthSessionResponseDto> {
    return this.refreshSessionUseCase.execute(input);
  }

  async register(input: RegisterInput): Promise<RegisterPendingResult> {
    return this.registerUseCase.execute(input);
  }

  async resendEmailVerificationOtp(
    input: ResendEmailVerificationOtpInput,
  ): Promise<ResendEmailVerificationOtpResult> {
    return this.resendEmailVerificationOtpUseCase.execute(input);
  }

  async verifyEmailOtp(
    input: VerifyEmailOtpRequestDto,
  ): Promise<VerifyEmailOtpResult> {
    return this.verifyEmailOtpUseCase.execute(input);
  }

  async changePassword(
    authorizationHeader: string | undefined,
    input: ChangePasswordRequestDto,
  ): Promise<ChangePasswordResult> {
    return this.changePasswordUseCase.execute(authorizationHeader, input);
  }

  async signAccessToken(input: SignAccessTokenInput): Promise<string> {
    return this.jwtTokenService.signAccessToken(input);
  }

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
    return this.verifyAccessTokenUseCase.execute(authorizationHeader);
  }
}
