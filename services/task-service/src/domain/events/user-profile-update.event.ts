export const USER_PROFILE_UPDATED_EVENT = "user_profile_updated";

// Payload Cập nhật: Tất cả đều là optional trừ userId
export interface UserProfileUpdatedEventPayload {
  userId: string;
  fullName?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean; // Dự phòng trường hợp Admin khóa tài khoản
}
