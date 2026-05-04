// src/application/commands/assign-task.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AssignTaskCommand } from './assign-task.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';
import { BusinessRuleException } from '../../domain/exceptions/BusinessRuleException';

@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler implements ICommandHandler<AssignTaskCommand, void> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException('Task', command.taskId);
    }

    // Unassign if assigneeId is null
    if (!command.assigneeId) {
      task.unassign();
    } else {
      // Validate assignee information
      if (!command.assigneeName) {
        throw new BusinessRuleException('Assignee name is required');
      }

      const assignedTo = UserSnapshot.create(
        command.assigneeId,
        command.assigneeName,
        command.assigneeAvatarUrl
      );

      task.assignTo(command.assigneeId, assignedTo);
    }

    await this.taskRepository.updateAsync(task);
  }
}
