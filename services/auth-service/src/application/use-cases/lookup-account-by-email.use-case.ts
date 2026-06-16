import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from '@/domain/repositories/user.repository';

export type AccountLookupResult = {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class LookupAccountByEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(email: string): Promise<AccountLookupResult | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const user = await this.userRepository.findUserByEmail(normalized);
    if (!user) {
      return null;
    }

    return {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
