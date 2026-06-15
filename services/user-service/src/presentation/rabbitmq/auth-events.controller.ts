import { AUTH_EMAIL_VERIFIED_EVENT } from '../../common/constants/events.constant';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { VerifyUserProfileEmailUseCase } from '../../application/use-cases/verify-user-profile-email.use-case';

type AuthEmailVerifiedEvent = {
  email: string;
  userId: string;
  verifiedAt: string;
};

@Controller()
export class AuthEventsController {
  constructor(private readonly verifyUserProfileEmailUseCase: VerifyUserProfileEmailUseCase) {}

  @EventPattern(AUTH_EMAIL_VERIFIED_EVENT)
  async handleAuthEmailVerified(@Payload() payload: AuthEmailVerifiedEvent): Promise<void> {
    await this.verifyUserProfileEmailUseCase.execute(payload.userId);
  }
}
