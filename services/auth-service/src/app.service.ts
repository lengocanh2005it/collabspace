import {
  AuthSession,
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import {
  AuthUser,
  ChangePasswordInput,
  ChangePasswordResult,
  LoginInput,
  RegisterInput,
  RegisterPendingResult,
  ResendEmailVerificationOtpInput,
  ResendEmailVerificationOtpResult,
  VerifyEmailOtpInput,
  VerifyEmailOtpResult,
} from '@/common/types/identity.type';
import {
  AuthIdentity,
  JwtPayload,
  SignAccessTokenInput,
} from '@/common/types/jwt.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { IdentityService } from '@/modules/identity/identity.service';
import { AuthOutboxService } from '@/modules/outbox/auth-outbox.service';
import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { RedisService } from '@/modules/redis/redis.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createSecretKey, randomInt } from 'crypto';
type EmailVerificationOtpPayload = {
  email: string;
  otpHash: string;
};

type EmailVerificationOtpDispatchResult = {
  email: string;
  otpExpiresInSeconds: number;
  userId: string;
};

type ResolvedUserProfileIdentity = {
  fullName?: string;
  username?: string;
  profileStatus?: 'available' | 'unavailable';
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly authOutboxService: AuthOutboxService,
    private readonly identityService: IdentityService,
    private readonly redisService: RedisService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly userProfilesGrpcService: UserProfilesGrpcService,
  ) {}

  async getCurrentUser(authorizationHeader?: string): Promise<
    AuthUser & {
      fullName?: string;
      username?: string;
      profileStatus?: 'available' | 'unavailable';
      workspaceId?: string | null;
    }
  > {
    const { payload, user } =
      await this.resolveVerifiedUserContext(authorizationHeader);
    const profileIdentity = await this.resolveUserProfileIdentity(user.userId);

    return {
      ...user,
      fullName: profileIdentity.fullName,
      username: profileIdentity.username,
      profileStatus: profileIdentity.profileStatus ?? 'available',
      workspaceId:
        this.readFirstString(
          payload.workspaceId,
          payload.workspace_id,
          payload.tenantId,
          payload.tenant_id,
        ) ?? null,
    };
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.identityService.validateCredentials(input);
    return this.issueSession(user, input.workspaceId);
  }

  async logout(input: LogoutInput): Promise<{ revoked: true }> {
    this.assertRefreshTokenInput(input);
    await this.refreshTokensService.revokeToken(
      input.refreshToken,
      'logged_out',
    );

    return { revoked: true };
  }

  async refresh(input: RefreshSessionInput): Promise<AuthSession> {
    this.assertRefreshTokenInput(input);
    const refreshTokenPayload = await this.refreshTokensService.rotate(
      input.refreshToken,
    );
    const user = await this.identityService.getAuthUserById(
      refreshTokenPayload.userId,
    );
    const accessToken = await this.signAccessToken({
      role: user.role,
      roles: user.roles,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? undefined,
    });

    return {
      accessToken,
      email: user.email,
      expiresIn: this.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      role: user.role,
      roles: user.roles,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? null,
    };
  }

  async register(input: RegisterInput): Promise<RegisterPendingResult> {
    const { user, newlyCreated } = await this.registerOrRecoverPendingUser(input);

    try {
      await this.userProfilesGrpcService.createPendingProfile({
        fullName: input.fullName,
        userId: user.userId,
      });
      const result = await this.sendEmailVerificationOtp(user);

      return {
        ...result,
        emailVerified: false,
        verificationRequired: true,
      };
    } catch (error) {
      if (newlyCreated) {
        await this.identityService.rollbackNewRegistration(user.userId);
      }

      throw error;
    }
  }

  async resendEmailVerificationOtp(
    input: ResendEmailVerificationOtpInput,
  ): Promise<ResendEmailVerificationOtpResult> {
    const email = input.email?.trim().toLowerCase();

    if (!email) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'Email is required',
      });
    }

    const user = await this.identityService.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'No pending verification found for this email',
      });
    }

    if (user.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'Email address has already been verified',
      });
    }

    await this.assertEmailVerificationResendAllowed(user.userId);
    const result = await this.sendEmailVerificationOtp(user);

    return {
      ...result,
      emailVerified: false,
      resent: true,
    };
  }

  async verifyEmailOtp(
    input: VerifyEmailOtpInput,
  ): Promise<VerifyEmailOtpResult> {
    const otp = input.otp?.trim();

    if (!input.userId || input.userId.trim().length === 0 || !otp) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'User id and OTP are required',
      });
    }

    const existingUser = await this.identityService.getAuthUserById(input.userId);

    if (existingUser.emailVerified) {
      return {
        email: existingUser.email,
        emailVerified: true,
        verified: true,
      };
    }

    const otpPayload =
      await this.redisService.getJson<EmailVerificationOtpPayload>(
        this.buildEmailVerificationOtpKey(input.userId),
      );

    if (!otpPayload) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_OTP_EXPIRED',
        message: 'Email verification code has expired',
      });
    }

    if (otpPayload.otpHash !== this.hashOtp(otp)) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_OTP_INVALID',
        message: 'Email verification code is invalid',
      });
    }

    const user = await this.identityService.markEmailVerified(input.userId);
    await this.redisService.delete(
      this.buildEmailVerificationOtpKey(input.userId),
    );

    return {
      email: user.email,
      emailVerified: true,
      verified: true,
    };
  }

  async changePassword(
    authorizationHeader: string | undefined,
    input: ChangePasswordInput,
  ): Promise<ChangePasswordResult> {
    const { userId } = await this.resolveVerifiedUserContext(authorizationHeader);
    await this.identityService.changePassword(
      userId,
      input.currentPassword,
      input.newPassword,
    );
    const revokedSessionCount = await this.refreshTokensService.revokeAllForUser(
      userId,
      'password_changed',
    );

    return {
      changed: true,
      revokedSessionCount,
      userId,
    };
  }

  async signAccessToken(input: SignAccessTokenInput): Promise<string> {
    const secret = this.getJwtSecret();
    const jwtConfig = this.configurationService.getAuthJwtConfig();
    const { SignJWT } = await import('jose');
    const jwt = new SignJWT({
      role: input.role ?? input.roles?.[0],
      roles: input.roles,
      workspaceId: input.workspaceId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuedAt()
      .setExpirationTime(jwtConfig.expiry);

    if (jwtConfig.issuer) {
      jwt.setIssuer(jwtConfig.issuer);
    }

    if (jwtConfig.audience) {
      jwt.setAudience(jwtConfig.audience);
    }

    return jwt.sign(secret);
  }

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
    const { payload, user, userId } =
      await this.resolveVerifiedUserContext(authorizationHeader);
    const profileIdentity = await this.resolveUserProfileIdentity(userId);

    return {
      emailVerified: user.emailVerified,
      fullName: profileIdentity.fullName,
      permissions: user.permissions,
      profileStatus: profileIdentity.profileStatus ?? 'available',
      roles: user.roles,
      userId,
      role: user.role,
      username: profileIdentity.username,
      workspaceId: this.readFirstString(
        payload.workspaceId,
        payload.workspace_id,
        payload.tenantId,
        payload.tenant_id,
      ),
    };
  }

  private async resolveVerifiedUserContext(
    authorizationHeader?: string,
  ): Promise<{
    payload: JwtPayload;
    user: AuthUser;
    userId: string;
  }> {
    const token = this.extractBearerToken(authorizationHeader);
    const payload = await this.verifyJwt(token);
    const userId = this.readFirstString(
      payload.sub,
      payload.userId,
      payload.user_id,
    );

    if (!userId) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access token payload is missing subject',
      });
    }

    const user = await this.identityService.getAuthUserById(userId);

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
      });
    }

    return {
      payload,
      user,
      userId,
    };
  }

  private async resolveUserProfileIdentity(
    userId: string,
  ): Promise<ResolvedUserProfileIdentity> {
    try {
      const profile = await this.userProfilesGrpcService.getProfile({ userId });
      return {
        fullName: profile.fullName?.trim() || undefined,
        username: profile.username?.trim() || undefined,
        profileStatus: 'available',
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Unable to resolve profile identity for user ${userId}: ${reason}`,
      );
      return { profileStatus: 'unavailable' };
    }
  }

  private async verifyJwt(token: string): Promise<JwtPayload> {
    const secret = this.getJwtSecret();
    const jwtConfig = this.configurationService.getAuthJwtConfig();
    const verificationOptions = {
      algorithms: ['HS256'],
      audience: jwtConfig.audience,
      issuer: jwtConfig.issuer,
    };

    try {
      const { jwtVerify } = await import('jose');
      const verified = await jwtVerify(token, secret, verificationOptions);
      return verified.payload as JwtPayload;
    } catch (error) {
      throw this.mapVerifyError(error);
    }
  }

  private extractBearerToken(authorizationHeader?: string): string {
    if (!authorizationHeader) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISSING',
        message: 'Authorization header is required',
      });
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Authorization header must use Bearer scheme',
      });
    }

    return token;
  }

  private getJwtExpiry(): string {
    return this.configurationService.getAuthJwtConfig().expiry;
  }

  private buildEmailVerificationOtpKey(userId: string): string {
    return `email-verification:otp:${userId}`;
  }

  private buildEmailVerificationResendCooldownKey(userId: string): string {
    return `email-verification:resend:cooldown:${userId}`;
  }

  private buildEmailVerificationResendAttemptsKey(userId: string): string {
    return `email-verification:resend:attempts:${userId}`;
  }

  private getJwtSecret() {
    const secret = this.configurationService.getAuthJwtConfig().secret;

    if (!secret) {
      throw new UnauthorizedException({
        code: 'JWT_SECRET_MISSING',
        message: 'JWT secret is not configured',
      });
    }

    return createSecretKey(Buffer.from(secret, 'utf8'));
  }

  private mapVerifyError(error: unknown): UnauthorizedException {
    if (!(error instanceof Error)) {
      return new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access token verification failed',
      });
    }

    switch (error.constructor.name) {
      case 'JWTExpired':
        return new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        });
      case 'JWTClaimValidationFailed':
      case 'JWTInvalid':
      case 'JOSEAlgNotAllowed':
      case 'JWSInvalid':
        return new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: error.message,
        });
      default:
        return new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: 'Access token verification failed',
        });
    }
  }

  private readFirstString(
    ...values: Array<string | undefined>
  ): string | undefined {
    return values.find(
      (value) => typeof value === 'string' && value.length > 0,
    );
  }

  private generateEmailVerificationOtp(): string {
    const { otpLength } =
      this.configurationService.getEmailVerificationConfig();
    const max = 10 ** otpLength;
    const otp = randomInt(0, max);

    return otp.toString().padStart(otpLength, '0');
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private isUserAlreadyExistsConflict(error: unknown): boolean {
    if (!(error instanceof ConflictException)) {
      return false;
    }

    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      (response as { code?: unknown }).code === 'USER_ALREADY_EXISTS'
    );
  }

  private async registerOrRecoverPendingUser(
    input: RegisterInput,
  ): Promise<{ newlyCreated: boolean; user: AuthUser }> {
    try {
      const user = await this.identityService.register(input);
      return { newlyCreated: true, user };
    } catch (error) {
      if (!this.isUserAlreadyExistsConflict(error)) {
        throw error;
      }

      const existingUser = await this.identityService.findUserByEmail(input.email);

      if (!existingUser || existingUser.emailVerified || !existingUser.isActive) {
        throw error;
      }

      this.logger.warn(
        `Recovered pending registration for ${existingUser.userId} via duplicate register request`,
      );

      return { newlyCreated: false, user: existingUser };
    }
  }

  private async assertEmailVerificationResendAllowed(
    userId: string,
  ): Promise<void> {
    const emailVerificationConfig =
      this.configurationService.getEmailVerificationConfig();
    const cooldownKey = this.buildEmailVerificationResendCooldownKey(userId);
    const attemptsKey = this.buildEmailVerificationResendAttemptsKey(userId);

    if (await this.redisService.exists(cooldownKey)) {
      const ttl = await this.redisService.ttl(cooldownKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_COOLDOWN',
          message: `Please wait ${Math.max(ttl, 1)} seconds before resending OTP`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const attempts = await this.redisService.increment(attemptsKey);

    if (attempts === 1) {
      await this.redisService.expire(
        attemptsKey,
        emailVerificationConfig.resendWindowSeconds,
      );
    }

    if (attempts > emailVerificationConfig.resendMaxAttempts) {
      const ttl = await this.redisService.ttl(attemptsKey);
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RESEND_LIMIT_REACHED',
          message: `OTP resend limit reached. Try again in ${Math.max(ttl, 1)} seconds`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(
      cooldownKey,
      '1',
      emailVerificationConfig.resendCooldownSeconds,
    );
  }

  private async sendEmailVerificationOtp(
    user: AuthUser,
  ): Promise<EmailVerificationOtpDispatchResult> {
    const otp = this.generateEmailVerificationOtp();
    const otpTtlSeconds =
      this.configurationService.getEmailVerificationConfig().otpTtlSeconds;

    await this.redisService.assertAvailable();
    await this.redisService.setJson(
      this.buildEmailVerificationOtpKey(user.userId),
      {
        email: user.email,
        otpHash: this.hashOtp(otp),
      } satisfies EmailVerificationOtpPayload,
      otpTtlSeconds,
    );
    await this.authOutboxService.enqueueEmailVerificationOtp({
      email: user.email,
      otp,
      otpTtlSeconds,
      userId: user.userId,
    });

    return {
      email: user.email,
      otpExpiresInSeconds: otpTtlSeconds,
      userId: user.userId,
    };
  }

  private assertRefreshTokenInput(input: RefreshSessionInput): void {
    if (!input.refreshToken || input.refreshToken.trim().length === 0) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Refresh token is required',
      });
    }
  }

  private async issueSession(
    user: AuthUser,
    workspaceId?: string,
  ): Promise<AuthSession> {
    const accessToken = await this.signAccessToken({
      role: user.role,
      roles: user.roles,
      userId: user.userId,
      workspaceId,
    });
    const refreshTokenPayload = await this.refreshTokensService.issue({
      userId: user.userId,
      workspaceId,
    });

    return {
      accessToken,
      email: user.email,
      expiresIn: this.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      role: user.role,
      roles: user.roles,
      userId: user.userId,
      workspaceId: workspaceId ?? null,
    };
  }
}
