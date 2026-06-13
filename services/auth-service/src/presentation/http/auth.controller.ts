import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RegisterInput, ResendEmailVerificationOtpInput } from '@/common/types/identity.type';
import type { RequestWithId } from '@/common/http/request-id.middleware';
import type { Request, Response } from 'express';
import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  LogoutRequestDto,
  RefreshSessionRequestDto,
  VerifyEmailOtpRequestDto,
} from '@/application/dto/auth-request.dto';
import { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import {
  ChangePasswordResponseDto,
  LogoutResponseDto,
  MeResponseDto,
  RegisterPendingResponseDto,
  ResendEmailVerificationOtpResponseDto,
  VerifyAccessResponseDto,
  VerifyEmailOtpResponseDto,
} from '@/application/dto/auth-response.dto';
import {
  LivenessReportDto,
  ReadinessReportDto,
} from '@/application/dto/health-response.dto';
import { ChangePasswordUseCase } from '@/application/use-cases/change-password.use-case';
import { GetCurrentUserUseCase } from '@/application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '@/application/use-cases/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '@/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import { ResendEmailVerificationOtpUseCase } from '@/application/use-cases/resend-email-verification-otp.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';
import { VerifyEmailOtpUseCase } from '@/application/use-cases/verify-email-otp.use-case';
import { AuthHealthService } from '@/health/auth-health.service';
import { assertMetricsAccess } from '@/metrics/metrics-access';
import { MetricsService } from '@/metrics/metrics.service';
import { AuthOutboxService } from '@/infrastructure/outbox/auth-outbox.service';
import { ConfigurationService } from '@/configuration/configuration.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly resendEmailVerificationOtpUseCase: ResendEmailVerificationOtpUseCase,
    private readonly verifyEmailOtpUseCase: VerifyEmailOtpUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly verifyAccessTokenUseCase: VerifyAccessTokenUseCase,
    private readonly authHealthService: AuthHealthService,
    private readonly metricsService: MetricsService,
    private readonly authOutboxService: AuthOutboxService,
    private readonly configurationService: ConfigurationService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health summary (readiness)' })
  @ApiOkResponse({ type: ReadinessReportDto })
  @ApiResponse({ status: 503, type: ReadinessReportDto })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.authHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('health/live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: LivenessReportDto })
  getLiveness() {
    return this.authHealthService.getLiveness();
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({ type: ReadinessReportDto })
  @ApiResponse({ status: 503, type: ReadinessReportDto })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.authHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('metrics')
  @ApiProduces('text/plain')
  @ApiOperation({ summary: 'Prometheus metrics (requires METRICS_AUTH_TOKEN)' })
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    response.set('Content-Type', this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password (verified email required)' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or email not verified' })
  async login(@Body() body: LoginRequestDto) {
    return this.loginUseCase.execute(body);
  }

  @Get('me')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user (profile hydrated when user-service is up)' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse()
  async me(@Req() request: Request) {
    return this.getCurrentUserUseCase.execute(request.header('authorization'));
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates auth user and pending user profile. Email verification OTP is sent asynchronously (outbox). Unverified accounts can recover via register with the same email.',
  })
  @ApiCreatedResponse({ type: RegisterPendingResponseDto })
  async register(@Body() body: RegisterInput) {
    return this.registerUseCase.execute(body);
  }

  @Post('resend-verification-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend email verification OTP',
    description:
      'Subject to resend cooldown and max attempts per window (see EMAIL_VERIFICATION_RESEND_* env vars). Returns 429 when rate limited.',
  })
  @ApiOkResponse({ type: ResendEmailVerificationOtpResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Resend cooldown or max attempts exceeded' })
  async resendVerificationOtp(@Body() body: ResendEmailVerificationOtpInput) {
    return this.resendEmailVerificationOtpUseCase.execute(body);
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description: 'OTP is hashed at rest in Redis. Invalid or expired OTP returns 401.',
  })
  @ApiOkResponse({ type: VerifyEmailOtpResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  async verifyEmail(@Body() body: VerifyEmailOtpRequestDto) {
    return this.verifyEmailOtpUseCase.execute(body);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  @ApiUnauthorizedResponse()
  async changePassword(
    @Req() request: Request,
    @Body() body: ChangePasswordRequestDto,
  ) {
    return this.changePasswordUseCase.execute(
      request.header('authorization'),
      body,
    );
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke refresh token session' })
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(@Body() body: LogoutRequestDto) {
    return this.logoutUseCase.execute(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiUnauthorizedResponse()
  async refresh(@Body() body: RefreshSessionRequestDto) {
    return this.refreshSessionUseCase.execute(body);
  }

  @Get('dev/otp')
  @HttpCode(200)
  @ApiOperation({
    summary: '[DEV ONLY] Get latest OTP for email — requires ALLOW_DEV_OTP_ENDPOINT=true',
  })
  async getDevOtp(@Query('email') email: string) {
    if (!this.configurationService.isDevOtpEndpointEnabled()) {
      throw new ForbiddenException('Dev OTP endpoint is disabled');
    }
    if (!email) {
      throw new NotFoundException('email query param required');
    }
    const otp = await this.authOutboxService.getDevOtp(email);
    if (!otp) {
      throw new NotFoundException(`No OTP found for ${email}`);
    }
    return { otp };
  }

  @Get('verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Traefik forward-auth token verification' })
  @ApiOkResponse({ type: VerifyAccessResponseDto })
  @ApiUnauthorizedResponse()
  async verify(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const identity = await this.verifyAccessTokenUseCase.execute(
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

    const requestId = (request as RequestWithId).requestId;
    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

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
