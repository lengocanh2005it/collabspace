import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { LogoutInput, RefreshSessionInput } from '@/common/types/auth-session.type';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResendEmailVerificationOtpInput,
  VerifyEmailOtpInput,
} from '@/common/types/identity.type';
import type { RequestWithId } from '@/common/http/request-id.middleware';
import type { Request, Response } from 'express';
import { AuthHealthService } from './health/auth-health.service';
import { assertMetricsAccess } from './metrics/metrics-access';
import { MetricsService } from './metrics/metrics.service';
import { AuthService } from './app.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authHealthService: AuthHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('health')
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.authHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('health/live')
  @HttpCode(200)
  getLiveness() {
    return this.authHealthService.getLiveness();
  }

  @Get('health/ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.authHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('metrics')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    response.set('Content-Type', this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Get('me')
  @HttpCode(200)
  async me(@Req() request: Request) {
    return this.authService.getCurrentUser(request.header('authorization'));
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  @Post('resend-verification-otp')
  @HttpCode(200)
  async resendVerificationOtp(@Body() body: ResendEmailVerificationOtpInput) {
    return this.authService.resendEmailVerificationOtp(body);
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailOtpInput) {
    return this.authService.verifyEmailOtp(body);
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Req() request: Request,
    @Body() body: ChangePasswordInput,
  ) {
    return this.authService.changePassword(
      request.header('authorization'),
      body,
    );
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() body: LogoutInput) {
    return this.authService.logout(body);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshSessionInput) {
    return this.authService.refresh(body);
  }

  @Get('verify')
  @HttpCode(200)
  async verify(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const identity = await this.authService.verifyAccessToken(
      request.header('authorization'),
    );

    response.setHeader('X-User-Id', identity.userId);

    if (identity.fullName) {
      response.setHeader('X-User-Name', identity.fullName);
    }

    if (identity.username) {
      response.setHeader('X-Username', identity.username);
    }

    if (identity.role) {
      response.setHeader('X-Role', identity.role);
    }

    if (identity.roles.length > 0) {
      response.setHeader('X-Roles', identity.roles.join(','));
    }

    if (identity.permissions.length > 0) {
      response.setHeader('X-Permissions', identity.permissions.join(','));
    }

    response.setHeader('X-Email-Verified', String(identity.emailVerified));

    if (identity.workspaceId) {
      response.setHeader('X-Workspace-Id', identity.workspaceId);
    }

    response.setHeader(
      'X-Request-Id',
      (request as RequestWithId).requestId,
    );

    return {
      authenticated: true,
      emailVerified: identity.emailVerified,
      fullName: identity.fullName ?? null,
      permissions: identity.permissions,
      profileStatus: identity.profileStatus ?? 'available',
      role: identity.role ?? null,
      roles: identity.roles,
      username: identity.username ?? null,
      workspaceId: identity.workspaceId ?? null,
      userId: identity.userId,
    };
  }
}
