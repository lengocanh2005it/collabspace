// src/domain/repositories/INotificationRepository.ts
import { Notification } from '../entities/Notification';
import { NotificationStatus } from '../value-objects/NotificationStatus';

/**
 * Notification Repository Interface (Port)
 * Định nghĩa contract cho persistence layer
 * Không phụ thuộc vào MongoDB, có thể implement với bất kỳ storage nào
 */
export interface INotificationRepository {
  /**
   * Tạo thông báo mới
   * @param notification Notification entity từ domain layer
   * @returns ID của notification được tạo
   */
  createAsync(notification: Notification): Promise<string>;

  /**
   * Tìm notification theo ID
   * @param id Notification ID
   * @returns Notification entity hoặc null nếu không tìm thấy
   */
  findByIdAsync(id: string): Promise<Notification | null>;

  /**
   * Tìm tất cả notification của một user
   * @param recipientId User ID
   * @param options Tùy chọn pagination
   * @returns Mảng Notification entities
   */
  findByRecipientIdAsync(
    recipientId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Notification[]>;

  /**
   * Tìm notification chưa đọc của một user
   * @param recipientId User ID
   * @returns Mảng Notification entities unread
   */
  findUnreadByRecipientIdAsync(recipientId: string): Promise<Notification[]>;

  /**
   * Đếm số notification chưa đọc của một user
   * @param recipientId User ID
   * @returns Số lượng notification unread
   */
  countUnreadByRecipientIdAsync(recipientId: string): Promise<number>;

  /**
   * Cập nhật notification
   * @param notification Notification entity với các thay đổi
   * @returns boolean - true nếu update thành công
   */
  updateAsync(notification: Notification): Promise<boolean>;

  /**
   * Xóa notification
   * @param id Notification ID
   * @returns boolean - true nếu delete thành công
   */
  deleteAsync(id: string): Promise<boolean>;

  /**
   * Đánh dấu tất cả notification của user là đã đọc
   * @param recipientId User ID
   * @returns Số lượng notification được update
   */
  markAllAsReadAsync(recipientId: string): Promise<number>;

  /**
   * Tìm notification theo type
   * @param recipientId User ID
   * @param type Loại notification
   * @returns Mảng Notification entities
   */
  findByTypeAsync(recipientId: string, type: string): Promise<Notification[]>;

  /**
   * Xóa các notification cũ (hơn N ngày)
   * @param daysOld Số ngày
   * @returns Số lượng notification bị xóa
   */
  deleteOldNotificationsAsync(daysOld: number): Promise<number>;
}

export const NOTIFICATION_REPOSITORY_TOKEN = 'INotificationRepository';
