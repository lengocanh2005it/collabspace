import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Headers,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserId } from './decorators/user-id.decorator';
import { CreateWorkspaceDto } from '../../application/dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../../application/dto/update-workspace.dto';
import { CreateWorkspaceUseCase } from '../../application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from '../../application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from '../../application/use-cases/workspace/update-workspace.use-case';
import { ListMembersUseCase } from '../../application/use-cases/workspace/list-members.use-case';
import { GetWorkspaceActivityUseCase } from '../../application/use-cases/workspace/get-workspace-activity.use-case';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { AuthGuard } from './guards/auth.guard';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(
    private readonly createWorkspaceUseCase: CreateWorkspaceUseCase,
    private readonly getWorkspaceUseCase: GetWorkspaceUseCase,
    private readonly listWorkspacesUseCase: ListWorkspacesUseCase,
    private readonly updateWorkspaceUseCase: UpdateWorkspaceUseCase,
    private readonly listMembersUseCase: ListMembersUseCase,
    private readonly getWorkspaceActivityUseCase: GetWorkspaceActivityUseCase,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create workspace' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional idempotency key (24h replay)',
  })
  async createWorkspace(
    @UserId() userId: string,
    @Body() dto: CreateWorkspaceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const route = 'POST /workspaces';

    if (idempotencyKey?.trim()) {
      const cached = await this.idempotencyService.findCached(
        userId,
        idempotencyKey.trim(),
      );

      if (cached) {
        response.status(cached.statusCode);
        return cached.body;
      }
    }

    const result = await this.createWorkspaceUseCase.execute(userId, dto);

    if (idempotencyKey?.trim()) {
      await this.idempotencyService.store(
        userId,
        idempotencyKey.trim(),
        route,
        201,
        result as unknown as Record<string, unknown>,
      );
      response.status(201);
    }

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for current user' })
  async listWorkspaces(@UserId() userId: string) {
    return this.listWorkspacesUseCase.execute(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.getWorkspaceUseCase.execute(userId, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async updateWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.updateWorkspaceUseCase.execute(userId, workspaceId, dto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List workspace members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listMembers(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.listMembersUseCase.execute(userId, workspaceId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get workspace activity timeline' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getActivity(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.getWorkspaceActivityUseCase.execute(userId, workspaceId, {
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
