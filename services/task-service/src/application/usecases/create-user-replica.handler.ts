// src/application/handlers/create-user-replica.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateUserReplicaCommand } from '../commands/create-user-replica.command';
import { IUserReplicaRepository, USER_REPLICA_REPOSITORY_TOKEN } from '../ports/IUserReplicaRepository';

@CommandHandler(CreateUserReplicaCommand)
export class CreateUserReplicaHandler implements ICommandHandler<CreateUserReplicaCommand> {
  constructor(@Inject(USER_REPLICA_REPOSITORY_TOKEN) private readonly repo: IUserReplicaRepository) {}

  async execute(command: CreateUserReplicaCommand): Promise<void> {
    // Chỉ tạo khung cơ bản, các trường khác mặc định null/false tùy schema
    await this.repo.upsertAsync({
      userId: command.userId,
      fullName: command.fullName,
      isActive: true,
    });
  }
}