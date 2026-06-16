import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Headers,
  Res,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  PaginatedWorkspaceActivityResponseSchemaDto,
  WorkspaceMemberResponseSchemaDto,
  WorkspaceResponseSchemaDto,
} from '../../application/dto/swagger-response.dto';
import type { Response } from 'express';
import { UserId } from './decorators/user-id.decorator';
import { CreateWorkspaceDto } from '../../application/dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../../application/dto/update-workspace.dto';
import { CreateWorkspaceUseCase } from '../../application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from '../../application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from '../../application/use-cases/workspace/update-workspace.use-case';
import { DeleteWorkspaceUseCase } from '../../application/use-cases/workspace/delete-workspace.use-case';
import { ListMembersUseCase } from '../../application/use-cases/workspace/list-members.use-case';
import { RemoveMemberUseCase } from '../../application/use-cases/workspace/remove-member.use-case';
import { UpdateMemberRoleUseCase } from '../../application/use-cases/workspace/update-member-role.use-case';
import { GetWorkspaceActivityUseCase } from '../../application/use-cases/workspace/get-workspace-activity.use-case';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { AuthGuard } from './guards/auth.guard';
import { UpdateMemberRoleDto } from '../../application/dto/update-member-role.dto';

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
    private readonly deleteWorkspaceUseCase: DeleteWorkspaceUseCase,
    private readonly listMembersUseCase: ListMembersUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
    private readonly updateMemberRoleUseCase: UpdateMemberRoleUseCase,
    private readonly getWorkspaceActivityUseCase: GetWorkspaceActivityUseCase,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create workspace' })
  @ApiCreatedResponse({ type: WorkspaceResponseSchemaDto })
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
      const cached = await this.idempotencyService.findCached(userId, idempotencyKey.trim());

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
  @ApiOkResponse({ type: WorkspaceResponseSchemaDto, isArray: true })
  async listWorkspaces(@UserId() userId: string) {
    return this.listWorkspacesUseCase.execute(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WorkspaceResponseSchemaDto })
  async getWorkspace(@UserId() userId: string, @Param('id', ParseUUIDPipe) workspaceId: string) {
    return this.getWorkspaceUseCase.execute(userId, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WorkspaceResponseSchemaDto })
  async updateWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.updateWorkspaceUseCase.execute(userId, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete workspace (owner only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async deleteWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
  ): Promise<void> {
    await this.deleteWorkspaceUseCase.execute(userId, workspaceId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List workspace members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: WorkspaceMemberResponseSchemaDto, isArray: true })
  async listMembers(@UserId() userId: string, @Param('id', ParseUUIDPipe) workspaceId: string) {
    return this.listMembersUseCase.execute(userId, workspaceId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove workspace member or leave workspace' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  async removeMember(
    @UserId() actorId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    await this.removeMemberUseCase.execute(actorId, workspaceId, targetUserId);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Promote/demote a workspace member role' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  async updateMemberRole(
    @UserId() actorId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<void> {
    await this.updateMemberRoleUseCase.execute(actorId, workspaceId, targetUserId, dto);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get workspace activity timeline' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaginatedWorkspaceActivityResponseSchemaDto })
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
