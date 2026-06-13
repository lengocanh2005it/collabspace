import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PaginatedUserSummaryResponseSchemaDto,
  UserPreferencesResponseSchemaDto,
  UserProfileResponseSchemaDto,
  UserStatusResponseSchemaDto,
  UserSummaryResponseSchemaDto,
} from './dto/user-swagger-response.dto';
import type { Request, Response } from 'express';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';
import { GetUserSummaryUseCase } from '../../application/use-cases/get-user-summary.use-case';
import { ListUserSummariesUseCase } from '../../application/use-cases/list-user-summaries.use-case';
import { BulkGetUserProfilesUseCase } from '../../application/use-cases/bulk-get-user-profiles.use-case';
import { GetUserPreferencesUseCase } from '../../application/use-cases/get-user-preferences.use-case';
import { UpdateUserPreferencesUseCase } from '../../application/use-cases/update-user-preferences.use-case';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile.use-case';
import { UpdateUserStatusUseCase } from '../../application/use-cases/update-user-status.use-case';
import { GetUserStatusesUseCase } from '../../application/use-cases/get-user-statuses.use-case';
import { AuthGrpcService } from '../../integrations/auth/auth-grpc.service';
import { BulkUsersRequestDto } from './dto/bulk-users-request.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PresenceQueryDto } from './dto/presence-query.dto';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import { UpdateCurrentUserPreferencesDto } from './dto/update-current-user-preferences.dto';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';
import { UpdateCurrentUserStatusDto } from './dto/update-current-user-status.dto';
import { UserHealthService } from '../../health/user-health.service';
import { assertMetricsAccess } from '../../metrics/metrics-access';
import { MetricsService } from '../../metrics/metrics.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly authGrpcService: AuthGrpcService,
    private readonly userHealthService: UserHealthService,
    private readonly metricsService: MetricsService,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly getUserSummaryUseCase: GetUserSummaryUseCase,
    private readonly listUserSummariesUseCase: ListUserSummariesUseCase,
    private readonly bulkGetUserProfilesUseCase: BulkGetUserProfilesUseCase,
    private readonly getUserPreferencesUseCase: GetUserPreferencesUseCase,
    private readonly updateUserPreferencesUseCase: UpdateUserPreferencesUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly updateUserStatusUseCase: UpdateUserStatusUseCase,
    private readonly getUserStatusesUseCase: GetUserStatusesUseCase,
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

  @Get('metrics')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    response.set('Content-Type', this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async getMe(@Headers('authorization') authorizationHeader?: string) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.getUserProfileUseCase.execute(identity.userId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async updateMe(
    @Body() body: UpdateCurrentUserProfileDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.updateUserProfileUseCase.execute(identity.userId, body);
  }

  @Get('me/preferences')
  @ApiOkResponse({ type: UserPreferencesResponseSchemaDto })
  async getMyPreferences(
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.getUserPreferencesUseCase.execute(identity.userId);
  }

  @Patch('me/preferences')
  @ApiOkResponse({ type: UserPreferencesResponseSchemaDto })
  async updateMyPreferences(
    @Body() body: UpdateCurrentUserPreferencesDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.updateUserPreferencesUseCase.execute(identity.userId, body);
  }

  @Patch('me/status')
  @ApiOkResponse({ type: UserStatusResponseSchemaDto })
  async updateMyStatus(
    @Body() body: UpdateCurrentUserStatusDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const identity = await this.requireIdentity(authorizationHeader);
    return this.updateUserStatusUseCase.execute(identity.userId, {
      clearAt: this.parseOptionalDate(body.clearAt),
      emoji: body.emoji,
      lastSeenAt: this.parseOptionalDate(body.lastSeenAt),
      status: body.status,
      statusText: body.statusText,
    });
  }

  @Get('presence')
  @ApiOkResponse({ type: UserStatusResponseSchemaDto, isArray: true })
  async getPresence(
    @Query() query: PresenceQueryDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.getUserStatusesUseCase.execute(query.userIds);
  }

  @Post('bulk')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk fetch profiles by user id (max 100)' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto, isArray: true })
  async bulkGetUsers(
    @Body() body: BulkUsersRequestDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.bulkGetUserProfilesUseCase.execute(body.userIds);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List/search user directory (mentions, assignees)' })
  @ApiOkResponse({ type: PaginatedUserSummaryResponseSchemaDto })
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

  @Get('search')
  @ApiOkResponse({ type: PaginatedUserSummaryResponseSchemaDto })
  async searchUsers(
    @Query() query: SearchUsersQueryDto,
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
  @ApiOkResponse({ type: UserSummaryResponseSchemaDto })
  async getSummary(
    @Param('id') id: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.getUserSummaryUseCase.execute(id.trim());
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile by user id' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async getById(
    @Param('id') id: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    await this.requireIdentity(authorizationHeader);
    return this.getUserProfileUseCase.execute(id.trim());
  }

  private parseOptionalDate(value?: string | null): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: 'DATE_INVALID',
        message: 'Date value is invalid',
      });
    }

    return date;
  }

  private async requireIdentity(authorizationHeader?: string) {
    return this.authGrpcService.verifyAccessToken(authorizationHeader);
  }
}
