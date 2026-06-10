import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UserId } from './decorators/user-id.decorator';
import { CreateWorkspaceDto } from '../../application/dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../../application/dto/update-workspace.dto';
import { CreateWorkspaceUseCase } from '../../application/use-cases/workspace/create-workspace.use-case';
import { GetWorkspaceUseCase } from '../../application/use-cases/workspace/get-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/use-cases/workspace/list-workspaces.use-case';
import { UpdateWorkspaceUseCase } from '../../application/use-cases/workspace/update-workspace.use-case';
import { ListMembersUseCase } from '../../application/use-cases/workspace/list-members.use-case';
import { UserIdGuard } from './guards/user-id.guard';

@Controller('workspaces')
@UseGuards(UserIdGuard)
export class WorkspaceController {
  constructor(
    private readonly createWorkspaceUseCase: CreateWorkspaceUseCase,
    private readonly getWorkspaceUseCase: GetWorkspaceUseCase,
    private readonly listWorkspacesUseCase: ListWorkspacesUseCase,
    private readonly updateWorkspaceUseCase: UpdateWorkspaceUseCase,
    private readonly listMembersUseCase: ListMembersUseCase,
  ) {}

  @Post()
  async createWorkspace(
    @UserId() userId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.createWorkspaceUseCase.execute(userId, dto);
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
