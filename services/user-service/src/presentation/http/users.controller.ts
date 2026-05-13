import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';
import { GetUserSummaryUseCase } from '../../application/use-cases/get-user-summary.use-case';
import { ListUserSummariesUseCase } from '../../application/use-cases/list-user-summaries.use-case';
import { BulkGetUserProfilesUseCase } from '../../application/use-cases/bulk-get-user-profiles.use-case';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile.use-case';
import { AuthGrpcService } from '../../integrations/auth/auth-grpc.service';
import { BulkUsersRequestDto } from './dto/bulk-users-request.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';
import { UserHealthService } from '../../health/user-health.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly authGrpcService: AuthGrpcService,
    private readonly userHealthService: UserHealthService,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly getUserSummaryUseCase: GetUserSummaryUseCase,
    private readonly listUserSummariesUseCase: ListUserSummariesUseCase,
    private readonly bulkGetUserProfilesUseCase: BulkGetUserProfilesUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
  ) {}

  @Get('health')
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.userHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('health/live')
  getLiveness() {
    return this.userHealthService.getLiveness();
  }

  @Get('health/ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.userHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('me')
  async getMe(@Headers('authorization') authorizationHeader?: string) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.getUserProfileUseCase.execute(identity.userId);
  }

  @Patch('me')
  async updateMe(
    @Body() body: UpdateCurrentUserProfileDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.updateUserProfileUseCase.execute(
      identity.userId,
      body,
    );
  }

  @Post('bulk')
  async bulkGetUsers(
    @Body() body: BulkUsersRequestDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.bulkGetUserProfilesUseCase.execute(body.userIds);
  }

  @Get()
  async listUsers(
    @Query() query: ListUsersQueryDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.listUserSummariesUseCase.execute({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      q: query.q,
    });
  }

  @Get(':id/summary')
  async getSummary(
    @Param('id') id: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.getUserSummaryUseCase.execute(id.trim());
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.getUserProfileUseCase.execute(id.trim());
  }

  private async requireIdentity(authorizationHeader?: string) {
    return this.authGrpcService.verifyAccessToken(authorizationHeader);
  }
}
