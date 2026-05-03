// src/app.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TaskController } from './presentation/controllers/task.controller';

// Command & Query Handlers
import { CreateTaskHandler } from './application/usecases/create-task.handler';
import { UpdateTaskDetailsHandler } from './application/usecases/update-task-details.handler';
import { ChangeTaskStatusHandler } from './application/usecases/change-task-status.handler';
import { AssignTaskHandler } from './application/usecases/assign-task.handler';
import { DeleteTaskHandler } from './application/usecases/delete-task.handler';
import { GetTaskByIdHandler } from './application/usecases/get-task-by-id.handler';
import { GetTasksHandler } from './application/usecases/get-tasks.handler';

// Repository & Schema
import { ITaskRepository } from './application/ports/ITaskRepository';
import { MongoTaskRepository } from './infrastructure/repositories/mongo-task.repository';
import { TaskSchema, TaskPersistence } from './infrastructure/persistence/task.schema';

const Handlers = [
  CreateTaskHandler,
  UpdateTaskDetailsHandler,
  ChangeTaskStatusHandler,
  AssignTaskHandler,
  DeleteTaskHandler,
  GetTaskByIdHandler,
  GetTasksHandler,
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

    MongooseModule.forFeature([{ name: TaskPersistence.name, schema: TaskSchema }]),
  ],
  controllers: [TaskController],
  providers: [
    ...Handlers,
    {
      provide: ITaskRepository,
      useClass: MongoTaskRepository,
    },
  ],
})
export class AppModule {}