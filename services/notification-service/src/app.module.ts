import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CqrsModule } from "@nestjs/cqrs";

import { ConfigurationModule } from "./configuration/configuartion.module";
import { ConfigurationService } from "./configuration/configuration.service";
import { TaskEventController } from "./presentation/controllers/internal/task-assign-event-listener.controller";
import { CommentEventListenerController } from "./presentation/controllers/internal/task-comment-event-listener.controller";
import { WorkspaceInviteEventListenerController } from "./presentation/controllers/internal/workspace-invite-event-listener.controller";
import { NotificationsController } from "./presentation/controllers/notifications.controller";
import { NotificationHealthService } from "./health/notification-health.service";
import { MetricsModule } from "./metrics/metrics.module";

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

const Handlers = [CreateNotificationHandler, GetNotificationsHandler];

@Module({
  imports: [
    ConfigurationModule,
    MetricsModule,
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
    ]),
  ],
  controllers: [
    NotificationsController,
    TaskEventController,
    CommentEventListenerController,
    WorkspaceInviteEventListenerController,
  ],
  providers: [
    ...Handlers,
    NotificationHealthService,
    {
      provide: NOTIFICATION_REPOSITORY_TOKEN,
      useClass: NotificationRepository,
    },
    {
      provide: PROCESSED_EVENT_REPOSITORY_TOKEN,
      useClass: ProcessedEventRepository,
    },
  ],
})
export class AppModule {}
