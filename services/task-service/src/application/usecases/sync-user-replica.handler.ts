import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SyncUserReplicaCommand } from 'src/application/commands/sync-user-replica.command';
import { IUserReplicaRepository } from '../ports/IUserReplicaRepository';

@CommandHandler(SyncUserReplicaCommand)
export class SyncUserReplicaHandler implements ICommandHandler<SyncUserReplicaCommand> {
  constructor(
    @Inject(IUserReplicaRepository)
    private readonly userReplicaRepo: IUserReplicaRepository,
  ) {}

  async execute(command: SyncUserReplicaCommand): Promise<void> {
    console.log(`[CQRS] Đang đồng bộ UserReplica cho user: ${command.userId}`);
    await this.userReplicaRepo.upsertAsync(
      command.userId, 
      command.name, 
      command.avatarUrl
    );
  }
}