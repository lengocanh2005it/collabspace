import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceOutboxService } from '../../../infrastructure/outbox/workspace-outbox.service';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly workspaceOutboxService: WorkspaceOutboxService,
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

    return this.dataSource.transaction(async (manager) => {
      const invitation = manager.create(InvitationOrmEntity, {
        workspace_id: workspaceId,
        inviter_id: userId,
        invitee_email: dto.email,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const saved = await manager.save(invitation);

      await this.workspaceOutboxService.enqueueWorkspaceInvited(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          invitationId: saved.id,
          workspaceId: saved.workspace_id,
          workspaceName: workspace?.name,
          invitedById: saved.inviter_id,
          inviteEmail: saved.invitee_email,
        },
        manager,
      );

      return saved;
    });
  }
}
