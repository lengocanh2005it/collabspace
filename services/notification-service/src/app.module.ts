import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CqrsModule } from "@nestjs/cqrs";

import { ConfigurationModule } from "./configuration/configuartion.module";
import { RedisModule } from "./infrastructure/cache/redis.module";
import { NotificationCountCacheService } from "./infrastructure/cache/notification-count-cache.service";
import { ConfigurationService } from "./configuration/configuration.service";
import { TaskEventController } from "./presentation/controllers/internal/task-assign-event-listener.controller";
import { CommentEventListenerController } from "./presentation/controllers/internal/task-comment-event-listener.controller";
import { WorkspaceInviteEventListenerController } from "./presentation/controllers/internal/workspace-invite-event-listener.controller";
import { NotificationsController } from "./presentation/controllers/notifications.controller";
import { NotificationHealthService } from "./health/notification-health.service";
import { MetricsModule } from "./metrics/metrics.module";
import { AuthModule } from "./integrations/auth/auth.module";
import { AuthGuard } from "./presentation/guards/auth.guard";

// Handlers & Persistence (Giữ nguyên các import của bạn)
import {
  Notification,
  NotificationSchema,
} from "./infrastructure/database/schemas/notification.schema";
import {
  ProcessedEvent,
  ProcessedEventSchema,
} from "./infrastructure/database/schemas/processed-event.schema";
import { NOTIFICATION_REPOSITORY_TOKEN } from "./domain/repositories/INotificationRepository";
import { PROCESSED_EVENT_REPOSITORY_TOKEN } from "./domain/repositories/IProcessedEventRepository";
import { NotificationRepository } from "./infrastructure/database/repositories/notification.repository";
import { ProcessedEventRepository } from "./infrastructure/database/repositories/processed-event.repository";
import { CreateNotificationHandler } from "./application/usecases/create-notification/create-notification.handler";
import { GetNotificationsHandler } from "./application/usecases/get-notifications/get-notifications.handler";
import { MarkNotificationReadHandler } from "./application/usecases/mark-notification-read/mark-notification-read.handler";
import { MarkAllNotificationsReadHandler } from "./application/usecases/mark-all-notifications-read/mark-all-notifications-read.handler";
import { CommentMentionEventListenerController } from "./presentation/controllers/internal/comment-mention-event-listener.controller";
import { UserEventListenerController } from "./presentation/controllers/internal/user-event-listener.controller";
import { WorkspaceDeleteEventListenerController } from "./presentation/controllers/internal/workspace-delete-event-listener.controller";
import { CreateUserReplicaHandler } from "./application/usecases/sync-user-replica/create-user-replica.handler";
import { SyncUserReplicaHandler } from "./application/usecases/sync-user-replica/sync-user-replica.handler";
import {
  UserReplica,
  UserReplicaSchema,
} from "./infrastructure/database/schemas/user-replica.schema";
import {
  BroadcastJob,
  BroadcastJobSchema,
} from "./infrastructure/database/schemas/broadcast-job.schema";
import { USER_REPLICA_REPOSITORY_TOKEN } from "./application/ports/IUserReplicaRepository";
import { UserReplicaRepository } from "./infrastructure/database/repositories/user-replica.repository";
import { UserProfileHttpClient } from "./infrastructure/clients/user-profile-http.client";
import {
  USER_REPLICA_LOOKUP_TOKEN,
  UserReplicaLookupService,
} from "./application/services/user-replica-lookup.service";
import { BroadcastJobService } from "./application/services/broadcast-job.service";
import { NotificationAdminController } from "./presentation/controllers/notification-admin.controller";
import { platformAdminAuthProviders } from "./integrations/auth/platform-admin-auth.providers";

const Handlers = [
  CreateNotificationHandler,
  GetNotificationsHandler,
  MarkNotificationReadHandler,
  MarkAllNotificationsReadHandler,
  CreateUserReplicaHandler,
  SyncUserReplicaHandler,
];

@Module({
  imports: [
    ConfigurationModule,
    MetricsModule,
    AuthModule,
    RedisModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule,
    MongooseModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        uri: config.getMongoConfig().uri,
      }),
    }),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: ProcessedEvent.name, schema: ProcessedEventSchema },
      { name: UserReplica.name, schema: UserReplicaSchema },
      { name: BroadcastJob.name, schema: BroadcastJobSchema },
    ]),
  ],
  controllers: [
    NotificationsController,
    NotificationAdminController,
    TaskEventController,
    CommentEventListenerController,
    CommentMentionEventListenerController,
    WorkspaceInviteEventListenerController,
    WorkspaceDeleteEventListenerController,
    UserEventListenerController,
  ],
  providers: [
    ...Handlers,
    NotificationHealthService,
    NotificationCountCacheService,
    AuthGuard,
    UserProfileHttpClient,
    UserReplicaLookupService,
    BroadcastJobService,
    ...platformAdminAuthProviders,
    {
      provide: NOTIFICATION_REPOSITORY_TOKEN,
      useClass: NotificationRepository,
    },
    {
      provide: PROCESSED_EVENT_REPOSITORY_TOKEN,
      useClass: ProcessedEventRepository,
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
