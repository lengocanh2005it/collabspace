import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import type { Channel, ConsumeMessage } from "amqplib";
// Định nghĩa lại Type này (hoặc import từ thư viện shared của team)
import type { TaskAssignedEventPayload } from "../../../domain/events";

import { CreateNotificationCommand } from "../../../application/usecases/create-notification/create-notification.command";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import { CommandBus } from "@nestjs/cqrs";

@Controller()
export class TaskEventController {
  private readonly logger = new Logger(TaskEventController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern("task_assigned") // Trùng với TASK_ASSIGNED_EVENT đã định nghĩa ở bên gửi
  async handleTaskAssignedEvent(
    @Payload() data: TaskAssignedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    try {
      this.logger.log(
        `📥 Nhận được event giao task cho User: ${data.recipientId}`,
      );

      // 1. Gọi Use Case để lưu vào MongoDB
      const eventId =
        data.eventId ??
        `task_assigned:${data.taskId}:${data.recipientId}:${data.assignedAt}`;

      await this.commandBus.execute(
        new CreateNotificationCommand(
          data.recipientId,
          data.actorId,
          NotificationType.TASK_ASSIGNED,
          "Giao việc mới",
          `${data.actorName} đã giao task "${data.taskTitle}" cho bạn`,
          data.taskId,
          "TASK",
          {
            actorName: data.actorName,
            actorAvatarUrl: data.actorAvatarUrl,
            taskTitle: data.taskTitle,
            assignedAt: data.assignedAt,
            workspaceId: data.workspaceId,
          },
          eventId,
        ),
      );

      // 2. Xác nhận (Ack) đã xử lý thành công để RabbitMQ xóa message khỏi queue
      const channel = context.getChannelRef() as Channel;
      const originalMsg = context.getMessage() as ConsumeMessage;
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        "❌ Lỗi khi xử lý event task_assigned",
        error instanceof Error ? error.stack : undefined,
      );
      // Logic xử lý lỗi (ví dụ đẩy sang Dead Letter Queue)
    }
  }
}
