import type { UserStatus } from '../../domain/entities/user-status.entity';

export type UserStatusResponseDto = {
  clearAt: string | null;
  emoji: string | null;
  lastSeenAt: string | null;
  status: string;
  statusText: string | null;
  updatedAt: string;
  userId: string;
};

export const toUserStatusResponseDto = (status: UserStatus): UserStatusResponseDto => ({
  clearAt: status.clearAt?.toISOString() ?? null,
  emoji: status.emoji,
  lastSeenAt: status.lastSeenAt?.toISOString() ?? null,
  status: status.status,
  statusText: status.statusText,
  updatedAt: status.updatedAt.toISOString(),
  userId: status.userId,
});
