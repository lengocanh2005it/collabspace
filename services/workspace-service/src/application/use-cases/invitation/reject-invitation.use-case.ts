import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';

@Injectable()
export class RejectInvitationUseCase {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitationRepo: Repository<InvitationOrmEntity>,
  ) {}

  async execute(userId: string, invitationId: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending')
      throw new BadRequestException('Invitation is not pending');

    invitation.status = 'rejected';
    invitation.invitee_user_id = userId;
    await this.invitationRepo.save(invitation);

    return { status: 'rejected' };
  }
}
