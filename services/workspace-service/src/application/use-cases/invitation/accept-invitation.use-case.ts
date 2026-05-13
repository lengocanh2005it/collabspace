import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitationRepo: Repository<InvitationOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, invitationId: string) {
    return this.invitationRepo.manager.transaction(async (manager) => {
      const invitation = await manager.findOne(InvitationOrmEntity, {
        where: { id: invitationId },
      });

      if (!invitation) throw new NotFoundException('Invitation not found');
      if (invitation.status !== 'pending')
        throw new BadRequestException('Invitation is not pending');
      if (invitation.expires_at < new Date())
        throw new BadRequestException('Invitation expired');

      invitation.status = 'accepted';
      invitation.invitee_user_id = userId;
      await manager.save(invitation);

      const member = manager.create(WorkspaceMemberOrmEntity, {
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: 'member',
      });
      await manager.save(member);

      return { status: 'accepted', workspace_id: invitation.workspace_id };
    });
  }
}
