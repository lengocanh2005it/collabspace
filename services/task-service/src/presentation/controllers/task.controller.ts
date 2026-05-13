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
  Headers,
  ParseFilePipe,
  MaxFileSizeValidator,
} from "@nestjs/common";
import { ApiConsumes, ApiBody } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express, Request } from "express";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateTaskRequest } from "../dtos/create-task.request";
import { UpdateTaskDetailsRequest } from "../dtos/update-task-details.request";
import { ChangeTaskStatusRequest } from "../dtos/change-task-status.request";
import { AssignTaskRequest } from "../dtos/assign-task.request";
import { CreateTaskResponse } from "../dtos/create-task.response";
import { TaskResponse } from "../dtos/task.response";
import { GetTasksResponse } from "../dtos/get-tasks.response";
import { CreateTaskCommand } from "../../application/commands/create-task.command";
import { UpdateTaskDetailsCommand } from "../../application/commands/update-task-details.command";
import { ChangeTaskStatusCommand } from "../../application/commands/change-task-status.command";
import { AssignTaskCommand } from "../../application/commands/assign-task.command";
import { DeleteTaskCommand } from "../../application/commands/delete-task.command";
import { UploadAttachmentCommand } from "../../application/commands/upload-attachment.command";
import { DeleteAttachmentCommand } from "../../application/commands/delete-attachment.command";
import { GetTaskByIdQuery } from "../../application/queries/get-task-by-id.query";
import { GetTasksQuery } from "../../application/queries/get-tasks.query";
import { created, ok } from "../common/response/api-response.wrapper";
import { WorkspaceValidationGuard } from "../guards/workspace-validation.guard";

@Controller("v1/tasks")
@UseGuards(WorkspaceValidationGuard)
export class TaskController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() request: CreateTaskRequest, @Req() req: any) {
    const currentUserId = "user-002";
    const currentUserName = "Người Dùng Hệ Thống";

    const command = new CreateTaskCommand(
      request.title,
      request.description || "",
      currentUserId,
      currentUserName,
      request.workspaceId,
    );

    const taskId: string = await this.commandBus.execute(command);

    return created(new CreateTaskResponse(taskId), req.headers["x-request-id"]);
  }

  /**
   * GET /tasks - Lấy danh sách task theo workspace
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getTasks(
    @Query("workspaceId") workspaceId: string,
    @Query("status") status?: string,
    @Query("assigneeId") assigneeId?: string,
    @Req() req?: any,
  ): Promise<any> {
    const query = new GetTasksQuery(workspaceId, status, assigneeId);
    const result = await this.queryBus.execute(query);

    return ok(
      new GetTasksResponse(result.tasks, result.total),
      req?.headers["x-request-id"],
    );
  }

  /**
   * GET /tasks/:id - Lấy chi tiết một task
   */
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getTaskById(
    @Param("id") taskId: string,
    @Req() req?: any,
  ): Promise<any> {
    const query = new GetTaskByIdQuery(taskId);
    const result = await this.queryBus.execute(query);

    return ok(result, req?.headers["x-request-id"]);
  }

  /**
   * PATCH /tasks/:id/details - Cập nhật thông tin chung (title, description)
   */
  @Patch(":id/details")
  @HttpCode(HttpStatus.OK)
  async updateTaskDetails(
    @Param("id") taskId: string,
    @Body() request: UpdateTaskDetailsRequest,
    @Req() req?: any,
  ): Promise<any> {
    const command = new UpdateTaskDetailsCommand(
      taskId,
      request.title,
      request.description || "",
    );

    await this.commandBus.execute(command);

    return ok(
      { message: "Cập nhật thông tin công việc thành công" },
      req?.headers["x-request-id"],
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
    @Req() req?: any,
  ): Promise<any> {
    const command = new ChangeTaskStatusCommand(taskId, request.status);

    await this.commandBus.execute(command);

    return ok(
      { message: "Đổi trạng thái công việc thành công" },
      req?.headers["x-request-id"],
    );
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
    @Req() req?: any,
  ): Promise<any> {
    // Mock tạm ID user đi giao (Assigner) - Sau này lấy từ req.user.id (JWT)
    const assignerId = "admin-001";

    // Khởi tạo Command với ĐÚNG 3 THAM SỐ
    const command = new AssignTaskCommand(
      taskId,
      assignerId,
      request.assigneeId || null,
    );

    console.log(
      "🔍 NỘI DUNG COMMAND MỚI (CHỈ CÓ ID):",
      JSON.stringify(command, null, 2),
    );

    await this.commandBus.execute(command);

    return { message: "Gán người phụ trách thành công" };
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
    file: Express.Multer.File,
    @Req() req: any,
  ): Promise<any> {
    if (!file) {
      throw new Error("File is required");
    }

    const command = new UploadAttachmentCommand(taskId, file);
    const result = await this.commandBus.execute(command);

    return created(
      {
        message: "File uploaded successfully",
        data: result,
      },
      req?.headers["x-request-id"],
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
    @Req() req: any,
  ): Promise<any> {
    if (!fileUrl) {
      throw new Error("fileUrl query parameter is required");
    }

    const command = new DeleteAttachmentCommand(taskId, fileUrl);
    await this.commandBus.execute(command);

    return ok(
      { message: "File deleted successfully" },
      req?.headers["x-request-id"],
    );
  }
}
