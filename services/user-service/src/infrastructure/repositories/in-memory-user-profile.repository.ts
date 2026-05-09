import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import {
  CreatePendingUserProfileInput,
  UserProfileRepository,
} from '../../domain/repositories/user-profile.repository';

@Injectable()
export class InMemoryUserProfileRepository implements UserProfileRepository {
  private profiles = [
    new UserProfile(
      'profile-1',
      'user-1',
      'Jane Doe',
      'https://cdn.example.com/avatar-1.png',
      'Product designer',
      true,
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    ),
    new UserProfile(
      'profile-2',
      'user-2',
      'John Smith',
      null,
      null,
      true,
      null,
      new Date('2026-01-03T00:00:00.000Z'),
      new Date('2026-01-04T00:00:00.000Z'),
    ),
  ];

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profiles.find((profile) => profile.userId === userId) ?? null;
  }

  async markEmailVerified(userId: string): Promise<UserProfile> {
    const profile = await this.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }

    const updatedProfile = new UserProfile(
      profile.id,
      profile.userId,
      profile.fullName,
      profile.avatarUrl,
      profile.bio,
      true,
      profile.deletedAt,
      profile.createdAt,
      new Date(),
    );

    this.profiles = this.profiles.map((item) =>
      item.userId === userId ? updatedProfile : item,
    );

    return updatedProfile;
  }

  async upsertPending(
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfile> {
    const existingProfile = await this.findByUserId(input.userId);
    const now = new Date();

    const profile = new UserProfile(
      existingProfile?.id ?? randomUUID(),
      input.userId,
      input.fullName,
      existingProfile?.avatarUrl ?? null,
      existingProfile?.bio ?? null,
      existingProfile?.emailVerified ?? false,
      null,
      existingProfile?.createdAt ?? now,
      now,
    );

    if (existingProfile) {
      this.profiles = this.profiles.map((item) =>
        item.userId === input.userId ? profile : item,
      );
      return profile;
    }

    this.profiles.push(profile);
    return profile;
  }
}
