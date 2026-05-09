import {
  AuthSession,
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import {
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/common/types/identity.type';
import {
  AuthIdentity,
  JwtPayload,
  SignAccessTokenInput,
} from '@/common/types/jwt.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { IdentityService } from '@/modules/identity/identity.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createSecretKey } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly identityService: IdentityService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async getCurrentUser(authorizationHeader?: string): Promise<
    AuthUser & {
      workspaceId?: string | null;
    }
  > {
    const { payload, user } = await this.resolveVerifiedUserContext(
      authorizationHeader,
    );

    return {
      ...user,
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

  async register(input: RegisterInput): Promise<AuthSession> {
    const user = await this.identityService.register(input);
    return this.issueSession(user, input.workspaceId);
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
    const { payload, user, userId } = await this.resolveVerifiedUserContext(
      authorizationHeader,
    );

    return {
      roles: user.roles,
      userId,
      role: user.role,
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
