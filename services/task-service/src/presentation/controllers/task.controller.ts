// src/presentation/controllers/task.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateTaskRequest } from '../dtos/create-task.request';
import { UpdateTaskDetailsRequest } from '../dtos/update-task-details.request';
import { ChangeTaskStatusRequest } from '../dtos/change-task-status.request';
import { AssignTaskRequest } from '../dtos/assign-task.request';
import { CreateTaskResponse } from '../dtos/create-task.response';
import { TaskResponse } from '../dtos/task.response';
import { GetTasksResponse } from '../dtos/get-tasks.response';
import { CreateTaskCommand } from '../../application/commands/create-task.command';
import { UpdateTaskDetailsCommand } from '../../application/commands/update-task-details.command';
import { ChangeTaskStatusCommand } from '../../application/commands/change-task-status.command';
import { AssignTaskCommand } from '../../application/commands/assign-task.command';
import { DeleteTaskCommand } from '../../application/commands/delete-task.command';
import { GetTaskByIdQuery } from '../../application/queries/get-task-by-id.query';
import { GetTasksQuery } from '../../application/queries/get-tasks.query';
import { created, ok } from '../common/response/api-response.wrapper';

@Controller('v1/tasks')
export class TaskController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  /**
   * POST /tasks - Tạo task mới
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @Body() request: CreateTaskRequest,
    @Req() req: any
  ): Promise<any> {
    const currentUserId = 'user-123';
    const currentUserName = 'Người Dùng Hệ Thống';

    const command = new CreateTaskCommand(
      request.title,
      request.description || '',
      currentUserId,
      currentUserName,
      request.workspaceId
    );

    const taskId: string = await this.commandBus.execute(command);

    return created(
      new CreateTaskResponse(taskId),
      req.headers['x-request-id']
    );
  }

  /**
   * GET /tasks - Lấy danh sách task theo workspace
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getTasks(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Req() req?: any
  ): Promise<any> {
    const query = new GetTasksQuery(workspaceId, status, assigneeId);
    const result = await this.queryBus.execute(query);

    return ok(
      new GetTasksResponse(result.tasks, result.total),
      req?.headers['x-request-id']
    );
  }

  /**
   * GET /tasks/:id - Lấy chi tiết một task
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getTaskById(
    @Param('id') taskId: string,
    @Req() req?: any
  ): Promise<any> {
    const query = new GetTaskByIdQuery(taskId);
    const result = await this.queryBus.execute(query);

    return ok(result, req?.headers['x-request-id']);
  }

  /**
   * PATCH /tasks/:id/details - Cập nhật thông tin chung (title, description)
   */
  @Patch(':id/details')
  @HttpCode(HttpStatus.OK)
  async updateTaskDetails(
    @Param('id') taskId: string,
    @Body() request: UpdateTaskDetailsRequest,
    @Req() req?: any
  ): Promise<any> {
    const command = new UpdateTaskDetailsCommand(
      taskId,
      request.title,
      request.description || ''
    );

    await this.commandBus.execute(command);

    return ok(
      { message: 'Cập nhật thông tin công việc thành công' },
      req?.headers['x-request-id']
    );
  }

  /**
   * PATCH /tasks/:id/status - Đổi trạng thái task
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async changeTaskStatus(
    @Param('id') taskId: string,
    @Body() request: ChangeTaskStatusRequest,
    @Req() req?: any
  ): Promise<any> {
    const command = new ChangeTaskStatusCommand(taskId, request.status);

    await this.commandBus.execute(command);

    return ok(
      { message: 'Đổi trạng thái công việc thành công' },
      req?.headers['x-request-id']
    );
  }

  /**
   * PATCH /tasks/:id/assignee - Gán người phụ trách task
   */
  @Patch(':id/assignee')
  @HttpCode(HttpStatus.OK)
  async assignTask(
    @Param('id') taskId: string,
    @Body() request: AssignTaskRequest,
    @Req() req?: any
  ): Promise<any> {
    const command = new AssignTaskCommand(
      taskId,
      request.assigneeId || null,
      request.assigneeName,
      request.assigneeAvatarUrl
    );

    await this.commandBus.execute(command);

    return ok(
      { message: 'Gán người phụ trách thành công' },
      req?.headers['x-request-id']
    );
  }

  /**
   * DELETE /tasks/:id - Xóa task
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteTask(
    @Param('id') taskId: string,
    @Req() req?: any
  ): Promise<any> {
    const command = new DeleteTaskCommand(taskId);

    await this.commandBus.execute(command);

    return ok(
      { message: 'Xóa công việc thành công' },
      req?.headers['x-request-id']
    );
  }
}