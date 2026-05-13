// src/presentation/controllers/internal/comment-event-listener.controller.ts
import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";

// Import cái Payload và Event name ông vừa định nghĩa
import { TASK_COMMENTED_EVENT } from "../../../domain/events/comment-events";
import { type TaskCommentedEventPayload } from "../../../domain/events/comment-events";
import { CreateNotificationCommand } from "../../../application/usecases/create-notification/create-notification.command";
import { NotificationType } from "../../../domain/value-objects/NotificationType"; // Nhớ trỏ đúng đường dẫn Enum của ông

@Controller()
export class CommentEventListenerController {
  private readonly logger = new Logger(CommentEventListenerController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(TASK_COMMENTED_EVENT)
  async handleTaskCommented(
    @Payload() data: TaskCommentedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as ConsumeMessage;

    console.log(
      `📥 [RABBITMQ] Bắt được event comment cho Task: ${data.taskId}`,
    );

    try {
      // Vì logic "có nên gửi Noti hay không" đã được Task Service xử lý,
      // nên ở đây cứ nhận được là LƯU & GỬI thôi.

      // Truyền đúng chuẩn 8 tham số vào Command
      const command = new CreateNotificationCommand(
        data.recipientId, // 1. recipientId (Người nhận)
        data.actorId, // 2. actorId (Người comment)
        NotificationType.TASK_COMMENT, // 3. Loại thông báo (Dùng Enum)
        "Bình luận mới trong Task", // 4. Tiêu đề
        `${data.actorName} đã bình luận: "${data.commentPreview}"`, // 5. Nội dung
        data.taskId, // 6. targetId (Trỏ về Task)
        "TASK", // 7. targetType (Thêm vào cho đồng bộ kiến trúc)
        {
          // 8. Metadata (Dành cho Frontend hiển thị UI)
          actorName: data.actorName,
          actorAvatarUrl: data.actorAvatarUrl,
          taskTitle: data.taskTitle,
          commentId: data.commentId,
          timestamp: data.createdAt,
        },
      );

      // Ném cho Handler xử lý lưu vào DB
      await this.commandBus.execute(command);

      // Báo cáo RabbitMQ là đã xử lý xong, xóa message khỏi Queue
      channel.ack(originalMsg);
      console.log("✅ Đã lưu thông báo Comment thành công!");
    } catch (error) {
      this.logger.error(
        "❌ Lỗi khi xử lý event comment_created",
        error instanceof Error ? error.stack : undefined,
      );
      // Nếu có lỗi liên quan tới kết nối DB, có thể mở nack ra để RabbitMQ tự gửi lại sau
      // channel.nack(originalMsg, false, true);
    }
  }
}
