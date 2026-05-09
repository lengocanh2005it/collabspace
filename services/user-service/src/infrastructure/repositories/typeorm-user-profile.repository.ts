import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import {
  CreatePendingUserProfileInput,
  UserProfileRepository,
} from '../../domain/repositories/user-profile.repository';
import { UserProfileOrmEntity } from '../database/entities/user-profile.orm-entity';

@Injectable()
export class TypeOrmUserProfileRepository implements UserProfileRepository {
  constructor(
    @InjectRepository(UserProfileOrmEntity)
    private readonly repository: Repository<UserProfileOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const profile = await this.repository.findOne({
      where: {
        userId,
      },
    });

    if (!profile) {
      return null;
    }

    return new UserProfile(
      profile.id,
      profile.userId,
      profile.fullName,
      profile.avatarUrl,
      profile.bio,
      profile.emailVerified,
      profile.deletedAt,
      profile.createdAt,
      profile.updatedAt,
    );
  }

  async markEmailVerified(userId: string): Promise<UserProfile> {
    const profile = await this.repository.findOne({
      where: {
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }

    profile.emailVerified = true;
    const savedProfile = await this.repository.save(profile);

    return new UserProfile(
      savedProfile.id,
      savedProfile.userId,
      savedProfile.fullName,
      savedProfile.avatarUrl,
      savedProfile.bio,
      savedProfile.emailVerified,
      savedProfile.deletedAt,
      savedProfile.createdAt,
      savedProfile.updatedAt,
    );
  }

  async upsertPending(
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfile> {
    const existingProfile = await this.repository.findOne({
      where: {
        userId: input.userId,
      },
    });

    const savedProfile = await this.repository.save(
      this.repository.create({
        avatarUrl: existingProfile?.avatarUrl ?? null,
        bio: existingProfile?.bio ?? null,
        deletedAt: null,
        emailVerified: existingProfile?.emailVerified ?? false,
        fullName: input.fullName,
        id: existingProfile?.id ?? randomUUID(),
        userId: input.userId,
      }),
    );

    return new UserProfile(
      savedProfile.id,
      savedProfile.userId,
      savedProfile.fullName,
      savedProfile.avatarUrl,
      savedProfile.bio,
      savedProfile.emailVerified,
      savedProfile.deletedAt,
      savedProfile.createdAt,
      savedProfile.updatedAt,
    );
  }
}
