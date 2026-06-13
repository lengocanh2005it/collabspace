import { LoginRequestDto } from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { IdentityService } from '@/modules/identity/identity.service';
import { Injectable } from '@nestjs/common';
import { SessionIssuanceService } from '../services/session-issuance.service';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly identityService: IdentityService,
    private readonly sessionIssuanceService: SessionIssuanceService,
  ) {}

  async execute(input: LoginRequestDto): Promise<AuthSessionResponseDto> {
    const user = await this.identityService.validateCredentials(input);
    return this.sessionIssuanceService.issue(user, input.workspaceId);
  }
}
