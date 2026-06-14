import { ForgotPasswordRequestDto } from '@/application/dto/auth-request.dto';
import type { ForgotPasswordResult } from '@/application/dto/auth-use-case-results';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { PasswordResetTokenService } from '../services/password-reset-token.service';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  async execute(input: ForgotPasswordRequestDto): Promise<ForgotPasswordResult> {
    const email = input.email?.trim().toLowerCase();
    const user = email ? await this.userRepository.findUserByEmail(email) : null;

    if (user?.emailVerified) {
      await this.passwordResetTokenService.send(user);
    }

    return {
      message:
        'If the account exists, password reset instructions were sent.',
      sent: true,
    };
  }
}
