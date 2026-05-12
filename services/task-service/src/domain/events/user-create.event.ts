export const USER_REGISTERED_EVENT = 'user_registered';

// Payload Đăng ký: Bắt buộc phải có email và fullName
export interface UserRegisteredEventPayload {
  userId: string;
  email: string;
  fullName: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}