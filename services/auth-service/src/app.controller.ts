import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type {
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import type {
  AssignRolePermissionInput,
  AssignUserRoleInput,
  CreatePermissionInput,
  CreateRoleInput,
  LoginInput,
  RegisterInput,
  ResendEmailVerificationOtpInput,
  VerifyEmailOtpInput,
} from '@/common/types/identity.type';
import type { Request, Response } from 'express';
import { IdentityService } from '@/modules/identity/identity.service';
import { AuthService } from './app.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly identityService: IdentityService,
  ) {}

  @Get('health')
  @HttpCode(200)
  getHealth() {
    return {
      service: 'auth-service',
      status: 'ok',
    };
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

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailOtpInput) {
    return this.authService.verifyEmailOtp(body);
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

    if (identity.role) {
      response.setHeader('X-Role', identity.role);
    }

    if (identity.roles.length > 0) {
      response.setHeader('X-Roles', identity.roles.join(','));
    }

    if (identity.workspaceId) {
      response.setHeader('X-Workspace-Id', identity.workspaceId);
    }

    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    return {
      authenticated: true,
      role: identity.role ?? null,
      workspaceId: identity.workspaceId ?? null,
      userId: identity.userId,
    };
  }
}
