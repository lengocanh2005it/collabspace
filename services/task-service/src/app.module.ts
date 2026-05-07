// src/app.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TaskController } from './presentation/controllers/task.controller';
import { TaskCommentController } from './presentation/controllers/task-comment.controller';

// Command & Query Handlers
import { CreateTaskHandler } from './application/usecases/create-task.handler';
import { UpdateTaskDetailsHandler } from './application/usecases/update-task-details.handler';
import { ChangeTaskStatusHandler } from './application/usecases/change-task-status.handler';
import { AssignTaskHandler } from './application/usecases/assign-task.handler';
import { DeleteTaskHandler } from './application/usecases/delete-task.handler';
import { GetTaskByIdHandler } from './application/usecases/get-task-by-id.handler';
import { GetTasksHandler } from './application/usecases/get-tasks.handler';
import { UploadAttachmentHandler } from './application/usecases/upload-attachment.handler';
import { DeleteAttachmentHandler } from './application/usecases/delete-attachment.handler';
import { CreateCommentHandler } from './application/usecases/comments/create/create-comment.handler';
import { GetTaskCommentsHandler } from './application/usecases/comments/get/get-task-comments.handler';
import { EditCommentHandler } from './application/usecases/comments/edit/edit-comment.handler';
import { DeleteCommentHandler } from './application/usecases/comments/delete/delete-comment.handler';

// Services
import { AzureBlobService } from './infrastructure/services/azure-blob.service';
import { WorkspaceMockService } from './infrastructure/services/workspace.mock.service';

// Guards
import { WorkspaceValidationGuard } from './presentation/guards/workspace-validation.guard';

// Repository & Schema
import { ITaskRepository } from './application/ports/ITaskRepository';
import { MongoTaskRepository } from './infrastructure/repositories/mongo-task.repository';
import { TaskSchema, TaskPersistence } from './infrastructure/persistence/task.schema';
import { ICommentRepository, COMMENT_REPOSITORY_TOKEN } from './domain/repositories/comment.repository.interface';
import { CommentRepository } from './infrastructure/repositories/comment.repository';
import { TaskComment, TaskCommentSchema } from './infrastructure/persistence/task-comment.schema';

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
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    CqrsModule,

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([
      { name: TaskPersistence.name, schema: TaskSchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
    ]),
  ],
  controllers: [TaskController, TaskCommentController],
  providers: [
    ...Handlers,
    AzureBlobService,
    WorkspaceMockService,
    WorkspaceValidationGuard,
    {
      provide: ITaskRepository,
      useClass: MongoTaskRepository,
    },
    {
      provide: COMMENT_REPOSITORY_TOKEN,
      useClass: CommentRepository,
    },
  ],
})
export class AppModule {}