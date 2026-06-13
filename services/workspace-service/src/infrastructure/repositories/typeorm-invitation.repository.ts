import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Invitation } from '../../domain/entities/invitation.entity';
import { IInvitationRepository } from '../../domain/repositories/invitation.repository';
import { WorkspaceOutboxService } from '../outbox/workspace-outbox.service';
import { InvitationOrmEntity } from '../database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../database/entities/workspace-member.orm-entity';

@Injectable()
export class TypeOrmInvitationRepository implements IInvitationRepository {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly repo: Repository<InvitationOrmEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly workspaceOutboxService: WorkspaceOutboxService,
  ) {}

  async findById(id: string): Promise<Invitation | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async createAndPublishInvited(data: {
    workspaceId: string;
    inviterId: string;
    inviteeEmail: string;
    workspaceName?: string;
  }): Promise<Invitation> {
    return this.dataSource.transaction(async (manager) => {
      const orm = manager.create(InvitationOrmEntity, {
        workspace_id: data.workspaceId,
        inviter_id: data.inviterId,
        invitee_email: data.inviteeEmail,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      const saved = await manager.save(orm);

      await this.workspaceOutboxService.enqueueWorkspaceInvited(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          invitationId: saved.id,
          workspaceId: saved.workspace_id,
          workspaceName: data.workspaceName,
          invitedById: saved.inviter_id,
          inviteEmail: saved.invitee_email,
        },
        manager,
      );

      return this.toDomain(saved);
    });
  }

  async acceptAndJoinWorkspace(
    invitationId: string,
    userId: string,
  ): Promise<{ status: string; workspaceId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const orm = await manager.findOne(InvitationOrmEntity, {
        where: { id: invitationId },
      });
      if (!orm) throw new NotFoundException('Invitation not found');
      if (orm.status !== 'pending')
        throw new BadRequestException('Invitation is not pending');
      if (orm.expires_at < new Date())
        throw new BadRequestException('Invitation expired');

      orm.status = 'accepted';
      orm.invitee_user_id = userId;
      await manager.save(orm);

      const existingMember = await manager.findOne(WorkspaceMemberOrmEntity, {
        where: { workspace_id: orm.workspace_id, user_id: userId },
      });

      if (!existingMember) {
        const member = manager.create(WorkspaceMemberOrmEntity, {
          workspace_id: orm.workspace_id,
          user_id: userId,
          role: 'member',
        });
        await manager.save(member);
      }

      return { status: 'accepted', workspaceId: orm.workspace_id };
    });
  }

  async updateStatus(
    id: string,
    status: string,
    userId?: string,
  ): Promise<Invitation> {
    const orm = await this.repo.findOne({ where: { id } });
    if (!orm) throw new NotFoundException('Invitation not found');
    orm.status = status;
    if (userId !== undefined) orm.invitee_user_id = userId;
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  private toDomain(orm: InvitationOrmEntity): Invitation {
    return new Invitation(
      orm.id,
      orm.workspace_id,
      orm.inviter_id,
      orm.invitee_email,
      orm.invitee_user_id,
      orm.status,
      orm.created_at,
      orm.expires_at,
    );
  }
}
