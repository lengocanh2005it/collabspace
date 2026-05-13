import { Module } from '@nestjs/common';
import { BulkGetUserProfilesUseCase } from './application/use-cases/bulk-get-user-profiles.use-case';
import { CreatePendingUserProfileUseCase } from './application/use-cases/create-pending-user-profile.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { GetUserSummaryUseCase } from './application/use-cases/get-user-summary.use-case';
import { ListUserSummariesUseCase } from './application/use-cases/list-user-summaries.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './integrations/auth/auth.module';
import { InMemoryUserProfileRepository } from './infrastructure/repositories/in-memory-user-profile.repository';
import { TypeOrmUserProfileRepository } from './infrastructure/repositories/typeorm-user-profile.repository';
import { UsersController } from './presentation/http/users.controller';
import { UserProfilesGrpcController } from './presentation/grpc/user-profiles.grpc.controller';
import { UserHealthService } from './health/user-health.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [UsersController, UserProfilesGrpcController],
  providers: [
    BulkGetUserProfilesUseCase,
    CreatePendingUserProfileUseCase,
    GetUserProfileUseCase,
    GetUserSummaryUseCase,
    InMemoryUserProfileRepository,
    ListUserSummariesUseCase,
    TypeOrmUserProfileRepository,
    UserHealthService,
    UpdateUserProfileUseCase,
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
