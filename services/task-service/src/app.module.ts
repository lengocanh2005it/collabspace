import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CqrsModule } from "@nestjs/cqrs";

import { TaskController } from "./presentation/controllers/task.controller";
import { TaskAdminController } from "./presentation/controllers/task-admin.controller";
import { HealthController } from "./presentation/controllers/health.controller";
import { TaskCommentController } from "./presentation/controllers/task-comment.controller";
import { TaskHealthService } from "./health/task-health.service";

import { CreateTaskHandler } from "./application/usecases/create-task.handler";
import { UpdateTaskDetailsHandler } from "./application/usecases/update-task-details.handler";
import { ChangeTaskStatusHandler } from "./application/usecases/change-task-status.handler";
import { AssignTaskHandler } from "./application/usecases/assign-task.handler";
import { DeleteTaskHandler } from "./application/usecases/delete-task.handler";
import { GetTaskByIdHandler } from "./application/usecases/get-task-by-id.handler";
import { GetTasksHandler } from "./application/usecases/get-tasks.handler";
import { GetTaskBoardHandler } from "./application/usecases/get-task-board.handler";
import { UploadAttachmentHandler } from "./application/usecases/upload-attachment.handler";
import { DeleteAttachmentHandler } from "./application/usecases/delete-attachment.handler";
import { CreateCommentHandler } from "./application/usecases/comments/create/create-comment.handler";
import { GetTaskCommentsHandler } from "./application/usecases/comments/get/get-task-comments.handler";
import { EditCommentHandler } from "./application/usecases/comments/edit/edit-comment.handler";
import { DeleteCommentHandler } from "./application/usecases/comments/delete/delete-comment.handler";
import { SyncUserReplicaHandler } from "./application/usecases/sync-user-replica.handler";
import { CreateUserReplicaHandler } from "./application/usecases/create-user-replica.handler";
import { GetTaskActivityHandler } from "./application/usecases/get-task-activity.handler";
import { CountTasksByWorkspaceAdminUseCase } from "./application/usecases/count-tasks-by-workspace-admin.use-case";
import { GetPlatformTaskStatsAdminUseCase } from "./application/usecases/get-platform-task-stats-admin.use-case";

import { AzureBlobService } from "./infrastructure/services/azure-blob.service";
import { WORKSPACE_CLIENT_TOKEN } from "./application/ports/IWorkspaceClient";
import { WorkspaceHttpClient } from "./infrastructure/clients/workspace-http.client";
import { UserProfileHttpClient } from "./infrastructure/clients/user-profile-http.client";
import {
  USER_REPLICA_LOOKUP_TOKEN,
  UserReplicaLookupService,
} from "./application/services/user-replica-lookup.service";
import { WorkspaceMockService } from "./infrastructure/services/workspace.mock.service";
import { WorkspaceMembershipCacheService } from "./infrastructure/cache/workspace-membership-cache.service";
import { TaskCommentCountService } from "./application/services/task-comment-count.service";
import { TaskCommentNotificationPublisher } from "./application/services/task-comment-notification.publisher";
import { WorkspaceDeletionService } from "./application/services/workspace-deletion.service";
import { WorkspaceDeletedKafkaConsumer } from "./infrastructure/messaging/kafka/workspace-deleted-kafka.consumer";
import { UserEventsKafkaConsumer } from "./infrastructure/messaging/kafka/user-events-kafka.consumer";
import { KafkaDlqPublisher } from "./infrastructure/messaging/kafka/kafka-dlq.publisher";
import { TaskOutboxService } from "./infrastructure/outbox/task-outbox.service";
import { TaskOutboxEvent, TaskOutboxEventSchema } from "./infrastructure/outbox/task-outbox.schema";
import { MongoUnitOfWork } from "./infrastructure/database/mongo-unit-of-work";
import { MONGO_UNIT_OF_WORK } from "./domain/ports/mongo-unit-of-work.port";
import {
  IdempotencyKeyRecord,
  IdempotencyKeySchema,
} from "./infrastructure/idempotency/idempotency-key.schema";
import { IdempotencyService } from "./infrastructure/idempotency/idempotency.service";

import { WorkspaceValidationGuard } from "./presentation/guards/workspace-validation.guard";
import { AuthGuard } from "./presentation/guards/auth.guard";

import { ITaskRepository } from "./application/ports/ITaskRepository";
import { EventSourcedMongoTaskRepository } from "./infrastructure/repositories/event-sourced-mongo-task.repository";
import { MongoTaskEventStore } from "./infrastructure/repositories/mongo-task-event.store";
import { ITaskEventStore } from "./application/ports/ITaskEventStore";
import { TaskSchema, TaskPersistence } from "./infrastructure/persistence/task.schema";
import {
  TaskEventPersistence,
  TaskEventSchema,
} from "./infrastructure/persistence/task-event.schema";
import {
  TaskActivityPersistence,
  TaskActivitySchema,
} from "./infrastructure/persistence/task-activity.schema";
import { ITaskActivityRepository } from "./application/ports/ITaskActivityRepository";
import { MongoTaskActivityRepository } from "./infrastructure/repositories/mongo-task-activity.repository";
import { COMMENT_REPOSITORY_TOKEN } from "./domain/repositories/comment.repository.interface";
import { CommentRepository } from "./infrastructure/repositories/comment.repository";
import { TaskComment, TaskCommentSchema } from "./infrastructure/persistence/task-comment.schema";
import { UserReplica, UserReplicaSchema } from "./infrastructure/persistence/user-replica.schema";
import { USER_REPLICA_REPOSITORY_TOKEN } from "./application/ports/IUserReplicaRepository";
import { UserReplicaRepository } from "./infrastructure/repositories/mongo-user-replica.repository";

import { ConfigurationModule } from "./configuration/configuration.module";
import { MetricsModule } from "./metrics/metrics.module";
import { AuthModule } from "./integrations/auth/auth.module";
import { platformAdminAuthProviders } from "./integrations/auth/platform-admin-auth.providers";
import { RedisModule } from "./infrastructure/cache/redis.module";
import { ConfigModule } from "@nestjs/config";

const Handlers = [
  CreateTaskHandler,
  UpdateTaskDetailsHandler,
  ChangeTaskStatusHandler,
  AssignTaskHandler,
  DeleteTaskHandler,
  GetTaskByIdHandler,
  GetTasksHandler,
  GetTaskBoardHandler,
  UploadAttachmentHandler,
  DeleteAttachmentHandler,
  CreateCommentHandler,
  GetTaskCommentsHandler,
  EditCommentHandler,
  DeleteCommentHandler,
  SyncUserReplicaHandler,
  CreateUserReplicaHandler,
  GetTaskActivityHandler,
  CountTasksByWorkspaceAdminUseCase,
  GetPlatformTaskStatsAdminUseCase,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigurationModule,
    MetricsModule,
    AuthModule,
    RedisModule,
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
      { name: TaskEventPersistence.name, schema: TaskEventSchema },
      { name: TaskActivityPersistence.name, schema: TaskActivitySchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: UserReplica.name, schema: UserReplicaSchema },
      { name: TaskOutboxEvent.name, schema: TaskOutboxEventSchema },
      { name: IdempotencyKeyRecord.name, schema: IdempotencyKeySchema },
    ]),
  ],
  controllers: [HealthController, TaskController, TaskAdminController, TaskCommentController],
  providers: [
    ...Handlers,
    TaskHealthService,
    AzureBlobService,
    WorkspaceMockService,
    WorkspaceHttpClient,
    WorkspaceMembershipCacheService,
    UserProfileHttpClient,
    UserReplicaLookupService,
    TaskOutboxService,
    MongoUnitOfWork,
    {
      provide: MONGO_UNIT_OF_WORK,
      useExisting: MongoUnitOfWork,
    },
    TaskCommentNotificationPublisher,
    TaskCommentCountService,
    WorkspaceDeletionService,
    WorkspaceDeletedKafkaConsumer,
    UserEventsKafkaConsumer,
    KafkaDlqPublisher,
    IdempotencyService,
    AuthGuard,
    WorkspaceValidationGuard,
    ...platformAdminAuthProviders,
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

        if (configService.get<string>("NODE_ENV") === "production") {
          throw new Error("FATAL: Mock workspace service is prohibited in production!");
        }

        return mockClient;
      },
      inject: [ConfigService, WorkspaceMockService, WorkspaceHttpClient],
    },
    MongoTaskEventStore,
    {
      provide: ITaskEventStore,
      useExisting: MongoTaskEventStore,
    },
    {
      provide: ITaskRepository,
      useClass: EventSourcedMongoTaskRepository,
    },
    {
      provide: ITaskActivityRepository,
      useClass: MongoTaskActivityRepository,
    },
    {
      provide: COMMENT_REPOSITORY_TOKEN,
      useClass: CommentRepository,
    },
    {
      provide: USER_REPLICA_REPOSITORY_TOKEN,
      useClass: UserReplicaRepository,
    },
    {
      provide: USER_REPLICA_LOOKUP_TOKEN,
      useExisting: UserReplicaLookupService,
    },
  ],
})
export class AppModule {}
