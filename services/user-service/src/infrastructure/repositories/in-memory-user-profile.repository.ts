import { Injectable } from '@nestjs/common';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileRepository } from '../../domain/repositories/user-profile.repository';

@Injectable()
export class InMemoryUserProfileRepository implements UserProfileRepository {
  private readonly profiles = [
    new UserProfile(
      'profile-1',
      'user-1',
      'Jane Doe',
      'https://cdn.example.com/avatar-1.png',
      'Product designer',
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
      null,
      new Date('2026-01-03T00:00:00.000Z'),
      new Date('2026-01-04T00:00:00.000Z'),
    ),
  ];

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profiles.find((profile) => profile.userId === userId) ?? null;
  }
}
