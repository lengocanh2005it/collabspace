import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
import { AzureBlobService } from '../../infrastructure/services/azure-blob.service';
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
import type { UploadedFile as CustomUploadedFile } from '../../common/types/uploaded-file';
import { isPlatformAdmin } from '@collabspace/shared';
import type { AuthenticatedRequest } from './authenticated-request';
import { AuthGuard } from './guards/auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly userHealthService: UserHealthService,
    private readonly metricsService: MetricsService,
    private readonly azureBlobService: AzureBlobService,
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
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async getMe(@Req() request: AuthenticatedRequest) {
    return this.getUserProfileUseCase.execute(request.user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async updateMe(
    @Body() body: UpdateCurrentUserProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.updateUserProfileUseCase.execute(request.user.id, body);
  }

  @Post('me/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: CustomUploadedFile,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const avatarUrl = await this.azureBlobService.uploadAvatar(
      file,
      request.user.id,
    );

    return this.updateUserProfileUseCase.execute(request.user.id, {
      avatarUrl,
    });
  }

  @Get('me/preferences')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserPreferencesResponseSchemaDto })
  async getMyPreferences(@Req() request: AuthenticatedRequest) {
    return this.getUserPreferencesUseCase.execute(request.user.id);
  }

  @Patch('me/preferences')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserPreferencesResponseSchemaDto })
  async updateMyPreferences(
    @Body() body: UpdateCurrentUserPreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.updateUserPreferencesUseCase.execute(request.user.id, body);
  }

  @Patch('me/status')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserStatusResponseSchemaDto })
  async updateMyStatus(
    @Body() body: UpdateCurrentUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.updateUserStatusUseCase.execute(request.user.id, {
      clearAt: this.parseOptionalDate(body.clearAt),
      emoji: body.emoji,
      lastSeenAt: this.parseOptionalDate(body.lastSeenAt),
      status: body.status,
      statusText: body.statusText,
    });
  }

  @Get('presence')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserStatusResponseSchemaDto, isArray: true })
  async getPresence(@Query() query: PresenceQueryDto) {
    return this.getUserStatusesUseCase.execute(query.userIds);
  }

  @Post('bulk')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk fetch profiles by user id (max 100)' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto, isArray: true })
  async bulkGetUsers(@Body() body: BulkUsersRequestDto) {
    return this.bulkGetUserProfilesUseCase.execute(body.userIds);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List/search user directory (mentions, assignees)' })
  @ApiOkResponse({ type: PaginatedUserSummaryResponseSchemaDto })
  async listUsers(
    @Query() query: ListUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertDirectoryAccess(request.user, query.q);
    return this.listUserSummariesUseCase.execute({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      q: query.q,
    });
  }

  @Get('search')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: PaginatedUserSummaryResponseSchemaDto })
  async searchUsers(
    @Query() query: SearchUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertDirectoryAccess(request.user, query.q);
    return this.listUserSummariesUseCase.execute({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      q: query.q,
    });
  }

  @Get(':id/summary')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserSummaryResponseSchemaDto })
  async getSummary(@Param('id') id: string) {
    return this.getUserSummaryUseCase.execute(id.trim());
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile by user id' })
  @ApiOkResponse({ type: UserProfileResponseSchemaDto })
  async getById(@Param('id') id: string) {
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

  private assertDirectoryAccess(
    identity: {
      permissions?: string[];
      role?: string;
      roles?: string[];
      userId: string;
    },
    query?: string,
  ) {
    if (query?.trim() || isPlatformAdmin(identity)) {
      return;
    }
    throw new ForbiddenException({
      code: 'DIRECTORY_QUERY_REQUIRED',
      message: 'Provide a search query to browse the user directory',
    });
  }
}
