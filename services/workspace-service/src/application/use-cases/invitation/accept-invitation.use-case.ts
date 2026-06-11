import { Inject, Injectable } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
  ) {}

  async execute(userId: string, invitationId: string) {
    return this.invitationRepo.acceptAndJoinWorkspace(invitationId, userId);
  }
}
