import { Module } from '@nestjs/common';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { InMemoryUserProfileRepository } from './infrastructure/repositories/in-memory-user-profile.repository';
import { UsersController } from './presentation/http/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    GetUserProfileUseCase,
    InMemoryUserProfileRepository,
    {
      provide: USER_PROFILE_REPOSITORY,
      useExisting: InMemoryUserProfileRepository,
    },
  ],
})
export class AppModule {}
