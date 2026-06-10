import { Module } from '@nestjs/common';
import { BulkGetUserProfilesUseCase } from './application/use-cases/bulk-get-user-profiles.use-case';
import { CreatePendingUserProfileUseCase } from './application/use-cases/create-pending-user-profile.use-case';
import { GetUserPreferencesUseCase } from './application/use-cases/get-user-preferences.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { GetUserStatusesUseCase } from './application/use-cases/get-user-statuses.use-case';
import { GetUserSummaryUseCase } from './application/use-cases/get-user-summary.use-case';
import { ListUserSummariesUseCase } from './application/use-cases/list-user-summaries.use-case';
import { UpdateUserPreferencesUseCase } from './application/use-cases/update-user-preferences.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile.use-case';
import { UpdateUserStatusUseCase } from './application/use-cases/update-user-status.use-case';
import { VerifyUserProfileEmailUseCase } from './application/use-cases/verify-user-profile-email.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { ConfigurationModule } from './configuration/configuration.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RabbitMqModule } from './infrastructure/messaging/rabbitmq/rabbitmq.module';
import { AuthModule } from './integrations/auth/auth.module';
import { InMemoryUserProfileRepository } from './infrastructure/repositories/in-memory-user-profile.repository';
import { TypeOrmUserProfileRepository } from './infrastructure/repositories/typeorm-user-profile.repository';
import { UserHealthService } from './health/user-health.service';
import { UsersController } from './presentation/http/users.controller';
import { UserProfilesGrpcController } from './presentation/grpc/user-profiles.grpc.controller';
import { AuthEventsController } from './presentation/rabbitmq/auth-events.controller';

@Module({
  imports: [ConfigurationModule, AuthModule, DatabaseModule, RabbitMqModule],
  controllers: [UsersController, UserProfilesGrpcController, AuthEventsController],
  providers: [
    BulkGetUserProfilesUseCase,
    CreatePendingUserProfileUseCase,
    GetUserPreferencesUseCase,
    GetUserProfileUseCase,
    GetUserStatusesUseCase,
    GetUserSummaryUseCase,
    InMemoryUserProfileRepository,
    ListUserSummariesUseCase,
    TypeOrmUserProfileRepository,
    UserHealthService,
    UpdateUserPreferencesUseCase,
    UpdateUserProfileUseCase,
    UpdateUserStatusUseCase,
    VerifyUserProfileEmailUseCase,
    {
      provide: USER_PROFILE_REPOSITORY,
      inject: [
        TypeOrmUserProfileRepository,
        InMemoryUserProfileRepository,
      ],
      useFactory: (
        typeOrmUserProfileRepository: TypeOrmUserProfileRepository,
        inMemoryUserProfileRepository: InMemoryUserProfileRepository,
      ) =>
        process.env.DATABASE_URL
          ? typeOrmUserProfileRepository
          : inMemoryUserProfileRepository,
    },
  ],
})
export class AppModule {}
