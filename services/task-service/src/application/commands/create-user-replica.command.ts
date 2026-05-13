// src/application/commands/create-user-replica.command.ts
export class CreateUserReplicaCommand {
  constructor(
    public readonly userId: string,
    public readonly fullName: string,
  ) {}
}
