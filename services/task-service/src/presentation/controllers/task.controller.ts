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
  UseInterceptors,
  UseGuards,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiSuccessCreateTaskResponseSchemaDto,
  ApiSuccessGetTasksResponseSchemaDto,
  ApiSuccessMessageResponseSchemaDto,
  ApiSuccessTaskBoardResponseSchemaDto,
  ApiSuccessTaskActivityResponseSchemaDto,
  ApiSuccessTaskResponseSchemaDto,
} from "../dtos/task-swagger-response.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { UploadedFile as TaskUploadedFile } from "../../common/types/uploaded-file";
import { CreateTaskRequest } from "../dtos/create-task.request";
import { UpdateTaskDetailsRequest } from "../dtos/update-task-details.request";
import { ChangeTaskStatusRequest } from "../dtos/change-task-status.request";
import { AssignTaskRequest } from "../dtos/assign-task.request";
import { CreateTaskResponse } from "../dtos/create-task.response";
import type { TaskResponseData } from "../dtos/task.response";
import { GetTasksResponse } from "../dtos/get-tasks.response";
import { CreateTaskCommand } from "../../application/commands/create-task.command";
import { UpdateTaskDetailsCommand } from "../../application/commands/update-task-details.command";
import { ChangeTaskStatusCommand } from "../../application/commands/change-task-status.command";
import { AssignTaskCommand } from "../../application/commands/assign-task.command";
import { UploadAttachmentCommand } from "../../application/commands/upload-attachment.command";
import { DeleteAttachmentCommand } from "../../application/commands/delete-attachment.command";
import { DeleteTaskCommand } from "../../application/commands/delete-task.command";
import { GetTaskByIdQuery } from "../../application/queries/get-task-by-id.query";
import { GetTasksQuery } from "../../application/queries/get-tasks.query";
import type { GetTasksResult } from "../../application/usecases/get-tasks.handler";
import { GetTaskBoardQuery } from "../../application/queries/get-task-board.query";
import { GetTaskBoardResponse } from "../dtos/get-task-board.response";
import { GetTaskActivityQuery } from "../../application/queries/get-task-activity.query";
import { TaskActivityResponse } from "../dtos/task-activity.response";
import type { UploadAttachmentResponse } from "../../application/usecases/upload-attachment.handler";
import { created, ok } from "../common/response/api-response.wrapper";
import { WorkspaceValidationGuard } from "../guards/workspace-validation.guard";
import { AuthGuard } from "../guards/auth.guard";
import { IdempotencyService } from "../../infrastructure/idempotency/idempotency.service";
import { getHeaderValue } from "../http/request-context";
import type { AppRequest } from "../http/request-context";

function assertUploadedFile(file: unknown): asserts file is TaskUploadedFile {
  if (
    !file ||
    typeof file !== "object" ||
    !("originalname" in file) ||
    !("mimetype" in file) ||
    !("size" in file) ||
    !("buffer" in file)
  ) {
    throw new Error("File is required");
  }
}

@ApiTags("tasks")
@ApiBearerAuth()
@Controller("tasks")
@UseGuards(AuthGuard, WorkspaceValidationGuard)
export class TaskController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create task" })
  @ApiCreatedResponse({ type: ApiSuccessCreateTaskResponseSchemaDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "Optional idempotency key (24h replay)",
  })
  async createTask(@Body() request: CreateTaskRequest, @Req() req: AppRequest) {
    const currentUserId = req.user.id;
    const currentUserName = req.user.name;
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const idempotencyKey = getHeaderValue(req.headers, "idempotency-key");
    const route = "POST /v1/tasks";

    if (idempotencyKey) {
      const cached = await this.idempotencyService.findCached(
        currentUserId,
        idempotencyKey,
      );

      if (cached) {
        return {
          ...cached.body,
          meta: { requestId, idempotentReplay: true },
        };
      }
    }

    const command = new CreateTaskCommand(
      request.title,
      request.description || "",
      currentUserId,
      currentUserName,
      request.workspaceId,
      request.projectId,
      request.priority,
      request.dueDate ? new Date(request.dueDate) : null,
      request.labels,
    );

    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      command,
    );

    const response = created(new CreateTaskResponse(taskId), requestId);

    if (idempotencyKey) {
      await this.idempotencyService.store(
        currentUserId,
        idempotencyKey,
        route,
        201,
        response,
      );
    }

    return response;
  }

  /**
   * GET /tasks - Lấy danh sách task theo workspace
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List tasks in workspace" })
  @ApiOkResponse({ type: ApiSuccessGetTasksResponseSchemaDto })
  @ApiQuery({ name: "workspaceId", required: true })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "assigneeId", required: false })
  @ApiQuery({ name: "priority", required: false })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getTasks(
    @Query("workspaceId") workspaceId: string,
    @Req() req: AppRequest,
    @Query("status") status?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("priority") priority?: string,
    @Query("projectId") projectId?: string,
    @Query("skip") skip?: string,
    @Query("limit") limit?: string,
  ): Promise<any> {
    const parsedSkip =
      skip != null && !Number.isNaN(Number(skip))
        ? Math.max(0, Number(skip))
        : undefined;
    const parsedLimit =
      limit != null && !Number.isNaN(Number(limit))
        ? Number(limit)
        : undefined;

    const query = new GetTasksQuery(
      workspaceId,
      status,
      assigneeId,
      priority,
      projectId,
      parsedSkip,
      parsedLimit,
    );
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const result = await this.queryBus.execute<GetTasksQuery, GetTasksResult>(
      query,
    );

    return ok(
      new GetTasksResponse(
        result.tasks,
        result.total,
        result.skip,
        result.limit,
      ),
      requestId,
    );
  }

  /**
   * GET /tasks/board - Kanban board grouped by status
   */
  @Get("board")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kanban board grouped by status" })
  @ApiOkResponse({ type: ApiSuccessTaskBoardResponseSchemaDto })
  @ApiQuery({ name: "workspaceId", required: true })
  @ApiQuery({ name: "projectId", required: false })
  async getTaskBoard(
    @Query("workspaceId") workspaceId: string,
    @Req() req: AppRequest,
    @Query("projectId") projectId?: string,
  ): Promise<any> {
    const query = new GetTaskBoardQuery(workspaceId, projectId);
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const result = await this.queryBus.execute<
      GetTaskBoardQuery,
      GetTaskBoardResponse
    >(query);

    return ok(result, requestId);
  }

  /**
   * GET /tasks/:id - Lấy chi tiết một task
   */
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get task by id" })
  @ApiOkResponse({ type: ApiSuccessTaskResponseSchemaDto })
  @ApiParam({ name: "id" })
  async getTaskById(
    @Param("id") taskId: string,
    @Req() req: AppRequest,
  ): Promise<any> {
    const query = new GetTaskByIdQuery(taskId);
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const result = await this.queryBus.execute<
      GetTaskByIdQuery,
      TaskResponseData
    >(query);

    return ok(result, requestId);
  }

  /**
   * GET /tasks/:id/activity - Timeline of events for a task
   */
  @Get(":id/activity")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Task activity timeline (events + comments)" })
  @ApiOkResponse({ type: ApiSuccessTaskActivityResponseSchemaDto })
  @ApiParam({ name: "id" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 50 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  async getTaskActivity(
    @Param("id") taskId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Req() req?: AppRequest,
  ): Promise<any> {
    const requestId = getHeaderValue(req!.headers, "x-request-id");
    const query = new GetTaskActivityQuery(
      taskId,
      limit ? Math.min(parseInt(limit, 10), 200) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    const result = await this.queryBus.execute<
      GetTaskActivityQuery,
      TaskActivityResponse
    >(query);
    return ok(result, requestId);
  }

  /**
   * PATCH /tasks/:id/details - Cập nhật thông tin chung (title, description)
   */
  @Patch(":id/details")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update task details" })
  @ApiOkResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  async updateTaskDetails(
    @Param("id") taskId: string,
    @Body() request: UpdateTaskDetailsRequest,
    @Req() req: AppRequest,
  ): Promise<any> {
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const command = new UpdateTaskDetailsCommand(
      taskId,
      request.title,
      request.description || "",
      request.priority,
      request.dueDate ? new Date(request.dueDate) : null,
      request.labels,
    );

    await this.commandBus.execute(command);

    return ok(
      { message: "Cập nhật thông tin công việc thành công" },
      requestId,
    );
  }

  /**
   * PATCH /tasks/:id/status - Đổi trạng thái task
   */
  @Patch(":id/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change task status" })
  @ApiOkResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  async changeTaskStatus(
    @Param("id") taskId: string,
    @Body() request: ChangeTaskStatusRequest,
    @Req() req: AppRequest,
  ): Promise<any> {
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const command = new ChangeTaskStatusCommand(taskId, request.status);

    await this.commandBus.execute(command);

    return ok({ message: "Đổi trạng thái công việc thành công" }, requestId);
  }

  /**
   * PATCH /tasks/:id/assignee - Gán người phụ trách task
   */
  // src/presentation/controllers/task.controller.ts
  @Patch(":id/assignee")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Assign or unassign task" })
  @ApiOkResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "Optional idempotency key (24h replay)",
  })
  async assignTask(
    @Param("id") taskId: string,
    @Body() request: AssignTaskRequest,
    @Req() req: AppRequest,
  ): Promise<any> {
    const assignerId = req.user.id;
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const idempotencyKey = getHeaderValue(req.headers, "idempotency-key");
    const route = `PATCH /v1/tasks/${taskId}/assignee`;

    if (idempotencyKey) {
      const cached = await this.idempotencyService.findCached(
        assignerId,
        idempotencyKey,
      );

      if (cached) {
        return {
          ...cached.body,
          meta: { requestId, idempotentReplay: true },
        };
      }
    }

    const command = new AssignTaskCommand(
      taskId,
      assignerId,
      request.assigneeId || null,
    );

    await this.commandBus.execute(command);

    const response = ok(
      { message: "Gán người phụ trách thành công" },
      requestId,
    );

    if (idempotencyKey) {
      await this.idempotencyService.store(
        assignerId,
        idempotencyKey,
        route,
        200,
        response,
      );
    }

    return response;
  }

  /**
   * DELETE /tasks/:id - Xóa task
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete task" })
  @ApiOkResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  async deleteTask(
    @Param("id") taskId: string,
    @Req() req: AppRequest,
  ): Promise<any> {
    const requestId = getHeaderValue(req.headers, "x-request-id");
    await this.commandBus.execute(new DeleteTaskCommand(taskId));

    return ok({ message: "Xóa công việc thành công" }, requestId);
  }

  /**
   * POST /tasks/:id/attachments - Upload file attachment
   * Accepts file via form-data with field name 'file'
   * File will be uploaded to Azure Blob Storage and URL stored in database
   */
  @Post(":id/attachments")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload task attachment" })
  @ApiCreatedResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  async uploadAttachment(
    @Param("id") taskId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
        fileIsRequired: true,
      }),
    )
    file: unknown,
    @Req() req: AppRequest,
  ): Promise<any> {
    assertUploadedFile(file);

    const requestId = getHeaderValue(req.headers, "x-request-id");
    const command = new UploadAttachmentCommand(taskId, file);
    const result = await this.commandBus.execute<
      UploadAttachmentCommand,
      UploadAttachmentResponse
    >(command);

    return created(
      {
        message: "File uploaded successfully",
        data: result,
      },
      requestId,
    );
  }

  /**
   * DELETE /tasks/:id/attachments - Remove file attachment
   * Query parameter: fileUrl - S3 URL of file to remove
   */
  @Delete(":id/attachments")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove task attachment" })
  @ApiOkResponse({ type: ApiSuccessMessageResponseSchemaDto })
  @ApiParam({ name: "id" })
  @ApiQuery({ name: "fileUrl", required: true })
  async deleteAttachment(
    @Param("id") taskId: string,
    @Query("fileUrl") fileUrl: string,
    @Req() req: AppRequest,
  ): Promise<any> {
    if (!fileUrl) {
      throw new Error("fileUrl query parameter is required");
    }

    const requestId = getHeaderValue(req.headers, "x-request-id");
    const command = new DeleteAttachmentCommand(taskId, fileUrl);
    await this.commandBus.execute(command);

    return ok({ message: "File deleted successfully" }, requestId);
  }
}
