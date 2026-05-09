import { Module } from '@nestjs/common';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { DatabaseModule } from './infrastructure/database/database.module';
import { InMemoryUserProfileRepository } from './infrastructure/repositories/in-memory-user-profile.repository';
import { TypeOrmUserProfileRepository } from './infrastructure/repositories/typeorm-user-profile.repository';
import { UsersController } from './presentation/http/users.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    GetUserProfileUseCase,
    InMemoryUserProfileRepository,
    TypeOrmUserProfileRepository,
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
