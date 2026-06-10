import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Headers,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserId } from './decorators/user-id.decorator';
import { CreateWorkspaceDto } from '../../application/dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../../application/dto/update-workspace.dto';
import { CreateWorkspaceUseCase } from '../../application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from '../../application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from '../../application/use-cases/workspace/update-workspace.use-case';
import { ListMembersUseCase } from '../../application/use-cases/workspace/list-members.use-case';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { AuthGuard } from './guards/auth.guard';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(
    private readonly createWorkspaceUseCase: CreateWorkspaceUseCase,
    private readonly getWorkspaceUseCase: GetWorkspaceUseCase,
    private readonly listWorkspacesUseCase: ListWorkspacesUseCase,
    private readonly updateWorkspaceUseCase: UpdateWorkspaceUseCase,
    private readonly listMembersUseCase: ListMembersUseCase,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
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
  async listWorkspaces(@UserId() userId: string) {
    return this.listWorkspacesUseCase.execute(userId);
  }

  @Get(':id')
  async getWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.getWorkspaceUseCase.execute(userId, workspaceId);
  }

  @Patch(':id')
  async updateWorkspace(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.updateWorkspaceUseCase.execute(userId, workspaceId, dto);
  }

  @Get(':id/members')
  async listMembers(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.listMembersUseCase.execute(userId, workspaceId);
  }
}
