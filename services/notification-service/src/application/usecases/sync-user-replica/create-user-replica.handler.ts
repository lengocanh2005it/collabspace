import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { CreateUserReplicaCommand } from "../../commands/create-user-replica.command";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../../ports/IUserReplicaRepository";

@CommandHandler(CreateUserReplicaCommand)
export class CreateUserReplicaHandler implements ICommandHandler<CreateUserReplicaCommand> {
  constructor(
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly repo: IUserReplicaRepository,
  ) {}

  async execute(command: CreateUserReplicaCommand): Promise<void> {
    await this.repo.upsertAsync({
      userId: command.userId,
      fullName: command.fullName,
      email:
        command.email?.trim() || `${command.userId}@users.collabspace.local`,
      username: command.username?.toLowerCase() ?? null,
      displayName: command.displayName ?? command.fullName,
      avatarUrl: command.avatarUrl ?? null,
      isActive: true,
    });
  }
}
