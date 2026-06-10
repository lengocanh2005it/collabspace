import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import type { Channel, ConsumeMessage } from "amqplib";
// Định nghĩa lại Type này (hoặc import từ thư viện shared của team)
import type { TaskAssignedEventPayload } from "../../../domain/events/task.events";

@Controller()
export class TaskEventController {
  private readonly logger = new Logger(TaskEventController.name);

  // constructor(private readonly processNotificationUseCase: ProcessNotificationUseCase) {}

  @EventPattern("task_assigned") // Trùng với TASK_ASSIGNED_EVENT đã định nghĩa ở bên gửi
  handleTaskAssignedEvent(
    @Payload() data: TaskAssignedEventPayload,
    @Ctx() context: RmqContext,
  ): void {
    try {
      this.logger.log(
        `📥 Nhận được event giao task cho User: ${data.recipientId}`,
      );

      // 1. Gọi Use Case để lưu vào MongoDB
      // await this.processNotificationUseCase.execute(data);

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
