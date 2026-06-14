import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import { AssignTaskCommand } from '../commands/assign-task.command';
import { ITaskRepository } from '../ports/ITaskRepository';

import type { IUserReplicaRepository } from '../ports/IUserReplicaRepository';
import {
  USER_REPLICA_REPOSITORY_TOKEN,
} from '../ports/IUserReplicaRepository';

import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';
import { BusinessRuleException } from '../../domain/exceptions/BusinessRuleException';
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler
  implements ICommandHandler<AssignTaskCommand, void>
{
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,

    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,

    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);

    // Command-side aggregate loading
    const task = await this.taskRepository.loadAggregateByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException('Task', command.taskId);
    }

    const assignerRecord = await this.userReplicaRepo.findByIdAsync(
      command.assignerId,
    );

    if (!assignerRecord || !assignerRecord.isActive) {
      throw new BusinessRuleException(
        'The assigner is invalid or inactive.',
      );
    }

    const assignerSnapshot = UserSnapshot.create(
      assignerRecord.userId,
      assignerRecord.email,
      assignerRecord.fullName,
      assignerRecord.displayName,
      assignerRecord.avatarUrl,
    );

    let assigneeSnapshot: UserSnapshot | null = null;

    if (!command.assigneeId) {
      task.unassign();
    } else {
      const assigneeRecord = await this.userReplicaRepo.findByIdAsync(
        command.assigneeId,
      );

      if (!assigneeRecord || !assigneeRecord.isActive) {
        throw new BusinessRuleException(
          'The assignee does not exist or is inactive.',
        );
      }

      assigneeSnapshot = UserSnapshot.create(
        assigneeRecord.userId,
        assigneeRecord.email,
        assigneeRecord.fullName,
        assigneeRecord.displayName,
        assigneeRecord.avatarUrl,
      );

      task.assignTo(command.assigneeId, assigneeSnapshot);
    }

    await this.taskRepository.saveAsync(task);

    if (assigneeSnapshot) {
      try {
        const occurred = new Date().toISOString();

        await this.rabbitMqEvents.publishTaskAssigned({
          eventId: randomUUID(),
          occurredAt: occurred,

          taskId: command.taskId,
          taskTitle: task.getTitle(),
          recipientId: assigneeSnapshot.getUserId(),

          actorId: assignerSnapshot.getUserId(),
          actorName: assignerSnapshot.getDisplayName(),
          actorAvatarUrl:
            assignerSnapshot.getAvatarUrl() || undefined,

          assignedAt: occurred,
          workspaceId: task.getWorkspaceId(),
        });
      } catch (error: unknown) {
        console.error('RabbitMQ Publish Error:', error);
      }
    }
  }
}