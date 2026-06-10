export const USER_REGISTERED_EVENT = 'user_registered';

// Payload Đăng ký: Bắt buộc phải có email và fullName
export interface UserRegisteredEventPayload {
  userId: string;
  fullName: string;
  email?: string;
  username?: string | null;
  occurredAt?: string;
}