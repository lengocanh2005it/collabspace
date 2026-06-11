import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';

@Injectable()
export class RejectInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
  ) {}

  async execute(userId: string, invitationId: string) {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending')
      throw new BadRequestException('Invitation is not pending');

    await this.invitationRepo.updateStatus(invitationId, 'rejected', userId);
    return { status: 'rejected' };
  }
}
