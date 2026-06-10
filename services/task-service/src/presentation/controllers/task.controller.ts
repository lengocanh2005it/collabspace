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
import { ApiConsumes, ApiBody } from "@nestjs/swagger";
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
import { GetTaskByIdQuery } from "../../application/queries/get-task-by-id.query";
import { GetTasksQuery } from "../../application/queries/get-tasks.query";
import type { UploadAttachmentResponse } from "../../application/usecases/upload-attachment.handler";
import { created, ok } from "../common/response/api-response.wrapper";
import { WorkspaceValidationGuard } from "../guards/workspace-validation.guard";
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

@Controller("v1/tasks")
@UseGuards(WorkspaceValidationGuard)
export class TaskController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() request: CreateTaskRequest, @Req() req: AppRequest) {
    const currentUserId = req.user.id;
    const currentUserName = req.user.name;
    const requestId = getHeaderValue(req.headers, "x-request-id");

    const command = new CreateTaskCommand(
      request.title,
      request.description || "",
      currentUserId,
      currentUserName,
      request.workspaceId,
    );

    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      command,
    );

    return created(new CreateTaskResponse(taskId), requestId);
  }

  /**
   * GET /tasks - Lấy danh sách task theo workspace
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getTasks(
    @Query("workspaceId") workspaceId: string,
    @Req() req: AppRequest,
    @Query("status") status?: string,
    @Query("assigneeId") assigneeId?: string,
  ): Promise<any> {
    const query = new GetTasksQuery(workspaceId, status, assigneeId);
    const requestId = getHeaderValue(req.headers, "x-request-id");
    const result = await this.queryBus.execute<GetTasksQuery, GetTasksResponse>(
      query,
    );

    return ok(new GetTasksResponse(result.tasks, result.total), requestId);
  }

  /**
   * GET /tasks/:id - Lấy chi tiết một task
   */
  @Get(":id")
  @HttpCode(HttpStatus.OK)
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
   * PATCH /tasks/:id/details - Cập nhật thông tin chung (title, description)
   */
  @Patch(":id/details")
  @HttpCode(HttpStatus.OK)
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
  async assignTask(
    @Param("id") taskId: string,
    @Body() request: AssignTaskRequest,
    @Req() req: AppRequest,
  ): Promise<any> {
    const assignerId = req.user.id;
    const requestId = getHeaderValue(req.headers, "x-request-id");

    const command = new AssignTaskCommand(
      taskId,
      assignerId,
      request.assigneeId || null,
    );

    await this.commandBus.execute(command);

    return ok({ message: "Gán người phụ trách thành công" }, requestId);
  }

  /**
   * POST /tasks/:id/attachments - Upload file attachment
   * Accepts file via form-data with field name 'file'
   * File will be uploaded to Azure Blob Storage and URL stored in database
   */
  @Post(":id/attachments")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
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
