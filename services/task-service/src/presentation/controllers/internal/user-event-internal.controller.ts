// src/presentation/controllers/internal/user-event.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { SyncUserReplicaCommand } from 'src/application/commands/sync-user-replica.command';
// Định nghĩa lại Type này (hoặc import từ thư viện shared của team)
@Controller()
export class UserEventController {
  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern('user_created')
  async handleUserCreated(@Payload() data: any) {
    await this.commandBus.execute(
      new SyncUserReplicaCommand(data.id, data.name, data.avatarUrl)
    );
  }

  @EventPattern('user_updated')
  async handleUserUpdated(@Payload() data: any) {
    await this.commandBus.execute(
      new SyncUserReplicaCommand(data.id, data.fullName, data.avatarUrl)
    );
  }
}