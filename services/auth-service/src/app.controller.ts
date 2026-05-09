import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type {
  LoginInput,
  LogoutInput,
  RefreshSessionInput,
} from '@/common/types/auth-session.type';
import type { Request, Response } from 'express';
import { AuthService } from './app.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

    const requestId = request.header('x-request-id');

    response.setHeader('X-User-Id', identity.userId);

    if (identity.role) {
      response.setHeader('X-Role', identity.role);
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
