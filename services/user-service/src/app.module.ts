import { Module } from '@nestjs/common';
import { CreatePendingUserProfileUseCase } from './application/use-cases/create-pending-user-profile.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { VerifyUserProfileEmailUseCase } from './application/use-cases/verify-user-profile-email.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { DatabaseModule } from './infrastructure/database/database.module';
import { InMemoryUserProfileRepository } from './infrastructure/repositories/in-memory-user-profile.repository';
import { TypeOrmUserProfileRepository } from './infrastructure/repositories/typeorm-user-profile.repository';
import { UsersController } from './presentation/http/users.controller';
import { UserProfilesGrpcController } from './presentation/grpc/user-profiles.grpc.controller';
import { AuthEventsController } from './presentation/rabbitmq/auth-events.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController, UserProfilesGrpcController, AuthEventsController],
  providers: [
    CreatePendingUserProfileUseCase,
    GetUserProfileUseCase,
    InMemoryUserProfileRepository,
    TypeOrmUserProfileRepository,
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
