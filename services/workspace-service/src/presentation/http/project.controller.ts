import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  DeleteProjectResponseSchemaDto,
  ProjectResponseSchemaDto,
} from '../../application/dto/swagger-response.dto';
import { UserId } from './decorators/user-id.decorator';
import { CreateProjectDto } from '../../application/dto/create-project.dto';
import { UpdateProjectDto } from '../../application/dto/update-project.dto';
import { CreateProjectUseCase } from '../../application/use-cases/project/create-project.use-case';
import { GetProjectUseCase } from '../../application/use-cases/project/get-project.use-case';
import { ListProjectsUseCase } from '../../application/use-cases/project/list-projects.use-case';
import { UpdateProjectUseCase } from '../../application/use-cases/project/update-project.use-case';
import { DeleteProjectUseCase } from '../../application/use-cases/project/delete-project.use-case';
import { AuthGuard } from './guards/auth.guard';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/projects')
@UseGuards(AuthGuard)
export class ProjectController {
  constructor(
    private readonly createProjectUseCase: CreateProjectUseCase,
    private readonly getProjectUseCase: GetProjectUseCase,
    private readonly listProjectsUseCase: ListProjectsUseCase,
    private readonly updateProjectUseCase: UpdateProjectUseCase,
    private readonly deleteProjectUseCase: DeleteProjectUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create project in workspace' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiCreatedResponse({ type: ProjectResponseSchemaDto })
  async createProject(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.createProjectUseCase.execute(userId, workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects in workspace' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiOkResponse({ type: ProjectResponseSchemaDto, isArray: true })
  async listProjects(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.listProjectsUseCase.execute(userId, workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by id' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProjectResponseSchemaDto })
  async getProject(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    return this.getProjectUseCase.execute(userId, workspaceId, projectId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProjectResponseSchemaDto })
  async updateProject(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.updateProjectUseCase.execute(userId, workspaceId, projectId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete project' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DeleteProjectResponseSchemaDto })
  async deleteProject(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    return this.deleteProjectUseCase.execute(userId, workspaceId, projectId);
  }
}
