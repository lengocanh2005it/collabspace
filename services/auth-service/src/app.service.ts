import {
  AuthSession,
  LoginInput,
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import {
  AuthIdentity,
  JwtPayload,
  SignAccessTokenInput,
} from '@/common/types/jwt.type';
import { ConfigurationService } from '@/configuration/configuration.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createSecretKey } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async login(input: LoginInput): Promise<AuthSession> {
    const identity = this.normalizeIdentity(input);
    const accessToken = await this.signAccessToken(identity);

    const refreshTokenPayload = await this.refreshTokensService.issue({
      userId: identity.userId,
      workspaceId: identity.workspaceId,
    });

    return {
      accessToken,
      expiresIn: this.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      role: identity.role,
      userId: identity.userId,
      workspaceId: identity.workspaceId ?? null,
    };
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
    const accessToken = await this.signAccessToken({
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? undefined,
    });

    return {
      accessToken,
      expiresIn: this.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? null,
    };
  }

  async signAccessToken(input: SignAccessTokenInput): Promise<string> {
    const secret = this.getJwtSecret();
    const jwtConfig = this.configurationService.getAuthJwtConfig();
    const { SignJWT } = await import('jose');
    const jwt = new SignJWT({
      role: input.role,
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
    const token = this.extractBearerToken(authorizationHeader);
    const secret = this.getJwtSecret();
    const jwtConfig = this.configurationService.getAuthJwtConfig();

    const verificationOptions = {
      algorithms: ['HS256'],
      audience: jwtConfig.audience,
      issuer: jwtConfig.issuer,
    };

    let payload: JwtPayload;

    try {
      const { jwtVerify } = await import('jose');
      const verified = await jwtVerify(token, secret, verificationOptions);
      payload = verified.payload as JwtPayload;
    } catch (error) {
      throw this.mapVerifyError(error);
    }

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

    return {
      userId,
      role: this.resolveRole(payload),
      workspaceId: this.readFirstString(
        payload.workspaceId,
        payload.workspace_id,
        payload.tenantId,
        payload.tenant_id,
      ),
    };
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

  private resolveRole(payload: JwtPayload): string | undefined {
    if (Array.isArray(payload.roles)) {
      return payload.roles.find(
        (role) => typeof role === 'string' && role.length > 0,
      );
    }

    return this.readFirstString(payload.role, payload.roles);
  }

  private assertRefreshTokenInput(input: RefreshSessionInput): void {
    if (!input.refreshToken || input.refreshToken.trim().length === 0) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_MISSING',
        message: 'Refresh token is required',
      });
    }
  }

  private normalizeIdentity(input: LoginInput): SignAccessTokenInput {
    if (!input.userId || input.userId.trim().length === 0) {
      throw new UnauthorizedException({
        code: 'LOGIN_IDENTITY_INVALID',
        message: 'User id is required to issue a session',
      });
    }

    return {
      role: input.role,
      userId: input.userId,
      workspaceId: input.workspaceId,
    };
  }
}
