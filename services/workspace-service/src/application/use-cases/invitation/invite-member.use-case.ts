import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { InviteMemberDto } from '../../dto/invite-member.dto';

@Injectable()
export class InviteMemberUseCase {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitationRepo: Repository<InvitationOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
    @InjectRepository(WorkspaceOrmEntity)
    private readonly workspaceRepo: Repository<WorkspaceOrmEntity>,
    @Inject('RABBITMQ_CHANNEL') private readonly rabbitChannel: amqp.Channel,
  ) {}

  async execute(userId: string, workspaceId: string, dto: InviteMemberDto) {
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins can invite members');
    }

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    // In a real app we'd look up the user by email via user-service here.
    // For now we just create the pending invitation.
    const invitation = this.invitationRepo.create({
      workspace_id: workspaceId,
      inviter_id: userId,
      invitee_email: dto.email,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const saved = await this.invitationRepo.save(invitation);

    // Publish event
    this.rabbitChannel.publish(
      'collabspace_exchange',
      'workspace.invited',
      Buffer.from(
        JSON.stringify({
          invitationId: saved.id,
          workspaceId: saved.workspace_id,
          workspaceName: workspace?.name,
          inviterId: saved.inviter_id,
          inviteeEmail: saved.invitee_email,
        }),
      ),
    );

    return saved;
  }
}
