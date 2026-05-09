import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
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
      profile.deletedAt,
      profile.createdAt,
      profile.updatedAt,
    );
  }
}
