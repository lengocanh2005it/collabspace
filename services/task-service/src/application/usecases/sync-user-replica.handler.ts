import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { SyncUserReplicaCommand } from "../commands/sync-user-replica.command";
import {
  IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../ports/IUserReplicaRepository";

@CommandHandler(SyncUserReplicaCommand)
export class SyncUserReplicaHandler implements ICommandHandler<SyncUserReplicaCommand> {
  constructor(
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly repo: IUserReplicaRepository,
  ) {}

  async execute(command: SyncUserReplicaCommand): Promise<void> {
    // Gọi hàm patch (updateFields) để không ghi đè dữ liệu cũ
    await this.repo.updateFieldsAsync(command.userId, {
      fullName: command.fullName,
      displayName: command.displayName,
      avatarUrl: command.avatarUrl,
    });
  }
}
