import type { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';

export const sampleUserProfile = {
  avatarUrl: 'https://cdn.example.com/avatar-1.png',
  bio: 'Product designer',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null as Date | null,
  displayName: 'Jane',
  fullName: 'Jane Doe',
  id: 'profile-1',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  userId: 'user-1',
  username: 'jane.doe',
};

export const sampleUserPreferences = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  dateFormat: 'YYYY-MM-DD',
  desktopNotificationsEnabled: true,
  digestFrequency: 'daily',
  emailNotificationsEnabled: true,
  language: 'en',
  pushNotificationsEnabled: false,
  theme: 'system',
  timeFormat: '24h',
  timezone: 'UTC',
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  userId: 'user-1',
  weekStartsOn: 'monday',
};

export const sampleUserStatus = {
  clearAt: null as Date | null,
  emoji: null as string | null,
  lastSeenAt: new Date('2026-01-02T10:00:00.000Z'),
  status: 'online',
  statusText: null as string | null,
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  userId: 'user-1',
};

export function createUserProfileRepositoryMock(): UserProfileRepository {
  return {
    anonymize: jest.fn(),
    findByUserId: jest.fn(),
    findByUsername: jest.fn(),
    findManyByUserIds: jest.fn(),
    getPreferences: jest.fn(),
    getStatus: jest.fn(),
    getStatusesByUserIds: jest.fn(),
    list: jest.fn(),
    updatePreferences: jest.fn(),
    updateProfile: jest.fn(),
    updateProfileInTransaction: jest.fn(),
    updateStatus: jest.fn(),
    upsertPending: jest.fn(),
    upsertPendingInTransaction: jest.fn(),
  };
}
