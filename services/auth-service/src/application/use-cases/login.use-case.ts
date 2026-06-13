import { LoginRequestDto } from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { SessionIssuanceService } from '../services/session-issuance.service';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly sessionIssuanceService: SessionIssuanceService,
  ) {}

  async execute(input: LoginRequestDto): Promise<AuthSessionResponseDto> {
    const user = await this.userRepository.validateCredentials(input);
    return this.sessionIssuanceService.issue(user, input.workspaceId);
  }
}
