// src/app.module.ts
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { TaskController } from "./presentation/controllers/task.controller";
import { HealthController } from "./presentation/controllers/health.controller";
import { TaskCommentController } from "./presentation/controllers/task-comment.controller";
import { TaskHealthService } from "./health/task-health.service";
import { TaskEventController } from "./presentation/controllers/internal/task-event-internal.controller";
import { UserEventController } from "./presentation/controllers/internal/user-event-internal.controller";

// Command & Query Handlers
import { CreateTaskHandler } from "./application/usecases/create-task.handler";
import { UpdateTaskDetailsHandler } from "./application/usecases/update-task-details.handler";
import { ChangeTaskStatusHandler } from "./application/usecases/change-task-status.handler";
import { AssignTaskHandler } from "./application/usecases/assign-task.handler";
import { DeleteTaskHandler } from "./application/usecases/delete-task.handler";
import { GetTaskByIdHandler } from "./application/usecases/get-task-by-id.handler";
import { GetTasksHandler } from "./application/usecases/get-tasks.handler";
import { UploadAttachmentHandler } from "./application/usecases/upload-attachment.handler";
import { DeleteAttachmentHandler } from "./application/usecases/delete-attachment.handler";
import { CreateCommentHandler } from "./application/usecases/comments/create/create-comment.handler";
import { GetTaskCommentsHandler } from "./application/usecases/comments/get/get-task-comments.handler";
import { EditCommentHandler } from "./application/usecases/comments/edit/edit-comment.handler";
import { DeleteCommentHandler } from "./application/usecases/comments/delete/delete-comment.handler";
import { SyncUserReplicaHandler } from "./application/usecases/sync-user-replica.handler";
import { CreateUserReplicaHandler } from "./application/usecases/create-user-replica.handler";

// Services
import { AzureBlobService } from "./infrastructure/services/azure-blob.service";
import { WORKSPACE_CLIENT_TOKEN } from "./application/ports/IWorkspaceClient";
import { WorkspaceHttpClient } from "./infrastructure/clients/workspace-http.client";
import { WorkspaceMockService } from "./infrastructure/services/workspace.mock.service";
import { TaskOutboxService } from "./infrastructure/outbox/task-outbox.service";
import { TaskOutboxProcessor } from "./infrastructure/outbox/task-outbox.processor";
import {
  TaskOutboxEvent,
  TaskOutboxEventSchema,
} from "./infrastructure/outbox/task-outbox.schema";
import { IdempotencyService } from "./infrastructure/idempotency/idempotency.service";
import {
  IdempotencyKeyRecord,
  IdempotencyKeySchema,
} from "./infrastructure/idempotency/idempotency-key.schema";

// Guards
import { WorkspaceValidationGuard } from "./presentation/guards/workspace-validation.guard";

// Repository & Schema
import { ITaskRepository } from "./application/ports/ITaskRepository";
import { MongoTaskRepository } from "./infrastructure/repositories/mongo-task.repository";
import {
  TaskSchema,
  TaskPersistence,
} from "./infrastructure/persistence/task.schema";
import { COMMENT_REPOSITORY_TOKEN } from "./domain/repositories/comment.repository.interface";
import { CommentRepository } from "./infrastructure/repositories/comment.repository";
import {
  TaskComment,
  TaskCommentSchema,
} from "./infrastructure/persistence/task-comment.schema";
import {
  UserReplica,
  UserReplicaSchema,
} from "./infrastructure/persistence/user-replica.schema";
import { USER_REPLICA_REPOSITORY_TOKEN } from "./application/ports/IUserReplicaRepository"; // Dùng Symbol 2-trong-1
import { UserReplicaRepository } from "./infrastructure/repositories/mongo-user-replica.repository";

import { RabbitMqModule } from "./infrastructure/messaging/rabbitmq/rabbitmq.module";
import { ConfigurationModule } from "./configuration/configuration.module";
import { MetricsModule } from "./metrics/metrics.module";

const Handlers = [
  CreateTaskHandler,
  UpdateTaskDetailsHandler,
  ChangeTaskStatusHandler,
  AssignTaskHandler,
  DeleteTaskHandler,
  GetTaskByIdHandler,
  GetTasksHandler,
  UploadAttachmentHandler,
  DeleteAttachmentHandler,
  CreateCommentHandler,
  GetTaskCommentsHandler,
  EditCommentHandler,
  DeleteCommentHandler,
  SyncUserReplicaHandler,
  CreateUserReplicaHandler,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ConfigurationModule,
    MetricsModule,
    RabbitMqModule,
    CqrsModule,

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>("MONGO_URI"),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([
      { name: TaskPersistence.name, schema: TaskSchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: UserReplica.name, schema: UserReplicaSchema },
      { name: TaskOutboxEvent.name, schema: TaskOutboxEventSchema },
      { name: IdempotencyKeyRecord.name, schema: IdempotencyKeySchema },
    ]),
  ],
  controllers: [
    HealthController,
    TaskController,
    TaskCommentController,
    TaskEventController,
    UserEventController, // 👈 Gắn cái lỗ tai nghe Event của RabbitMQ vào đây
  ],
  providers: [
    ...Handlers,
    TaskHealthService,
    AzureBlobService,
    WorkspaceMockService,
    WorkspaceHttpClient,
    TaskOutboxService,
    TaskOutboxProcessor,
    IdempotencyService,
    WorkspaceValidationGuard,
    {
      provide: WORKSPACE_CLIENT_TOKEN,
      useFactory: (
        configService: ConfigService,
        mockClient: WorkspaceMockService,
        httpClient: WorkspaceHttpClient,
      ) => {
        if (configService.get<string>("WORKSPACE_CLIENT_MODE") === "http") {
          return httpClient;
        }

        return mockClient;
      },
      inject: [ConfigService, WorkspaceMockService, WorkspaceHttpClient],
    },
    {
      provide: ITaskRepository,
      useClass: MongoTaskRepository,
    },
    {
      provide: COMMENT_REPOSITORY_TOKEN,
      useClass: CommentRepository,
    },
    {
      provide: USER_REPLICA_REPOSITORY_TOKEN,
      useClass: UserReplicaRepository,
    },
  ],
})
export class AppModule {}
