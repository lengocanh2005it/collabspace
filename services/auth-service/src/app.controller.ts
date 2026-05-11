import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type {
  LogoutOtherSessionsInput,
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import type {
  AssignRolePermissionInput,
  AssignUserRoleInput,
  ChangePasswordInput,
  CreatePermissionInput,
  CreateRoleInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResendEmailVerificationOtpInput,
  VerifyEmailOtpInput,
} from '@/common/types/identity.type';
import type { Request, Response } from 'express';
import { IdentityService } from '@/modules/identity/identity.service';
import { AuthHealthService } from './health/auth-health.service';
import { AuthService } from './app.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authHealthService: AuthHealthService,
    private readonly identityService: IdentityService,
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

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordInput) {
    return this.authService.forgotPassword(body);
  }

  @Get('me')
  @HttpCode(200)
  async me(@Req() request: Request) {
    return this.authService.getCurrentUser(request.header('authorization'));
  }

  @Get('sessions')
  @HttpCode(200)
  async sessions(@Req() request: Request) {
    return this.authService.getSessions(request.header('authorization'));
  }

  @Post('permissions')
  @HttpCode(201)
  async createPermission(@Body() body: CreatePermissionInput) {
    return this.identityService.createPermission(body);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  @Post('roles')
  @HttpCode(201)
  async createRole(@Body() body: CreateRoleInput) {
    return this.identityService.createRole(body);
  }

  @Post('resend-verification-otp')
  @HttpCode(200)
  async resendVerificationOtp(@Body() body: ResendEmailVerificationOtpInput) {
    return this.authService.resendEmailVerificationOtp(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordInput) {
    return this.authService.resetPassword(body);
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

  @Post('roles/:roleId/permissions')
  @HttpCode(200)
  async assignPermissionToRole(
    @Param('roleId') roleId: string,
    @Body() body: AssignRolePermissionInput,
  ) {
    return this.identityService.assignPermissionToRole(roleId, body);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() body: LogoutInput) {
    return this.authService.logout(body);
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@Req() request: Request) {
    return this.authService.logoutAll(request.header('authorization'));
  }

  @Post('logout-others')
  @HttpCode(200)
  async logoutOthers(
    @Req() request: Request,
    @Body() body: LogoutOtherSessionsInput,
  ) {
    return this.authService.logoutOthers(
      request.header('authorization'),
      body,
    );
  }

  @Delete('sessions/:familyId')
  @HttpCode(200)
  async revokeSession(
    @Req() request: Request,
    @Param('familyId') familyId: string,
  ) {
    return this.authService.revokeSession(
      request.header('authorization'),
      familyId,
    );
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshSessionInput) {
    return this.authService.refresh(body);
  }

  @Post('users/:userId/roles')
  @HttpCode(200)
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() body: AssignUserRoleInput,
  ) {
    return this.identityService.assignRoleToUser(userId, body);
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

    const requestId = request.header('x-request-id');

    response.setHeader('X-User-Id', identity.userId);

    if (identity.fullName) {
      response.setHeader('X-User-Name', identity.fullName);
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

    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    return {
      authenticated: true,
      emailVerified: identity.emailVerified,
      permissions: identity.permissions,
      role: identity.role ?? null,
      roles: identity.roles,
      workspaceId: identity.workspaceId ?? null,
      userId: identity.userId,
    };
  }
}
