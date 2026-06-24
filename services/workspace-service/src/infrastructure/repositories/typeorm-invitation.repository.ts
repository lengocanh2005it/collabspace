import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { Invitation } from '../../domain/entities/invitation.entity';
import { InvitationInvalidStateError } from '../../domain/exceptions/invitation.exceptions';
import type {
  AcceptInvitationResult,
  IInvitationRepository,
} from '../../domain/repositories/invitation.repository';
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

  async findPendingByWorkspace(workspaceId: string): Promise<Invitation[]> {
    const orms = await this.repo.find({
      where: { workspace_id: workspaceId, status: 'pending' },
      order: { created_at: 'DESC' },
    });

    return orms.map((orm) => this.toDomain(orm));
  }

  async findPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string,
  ): Promise<Invitation | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const orm = await this.repo.findOne({
      where: {
        workspace_id: workspaceId,
        invitee_email: normalizedEmail,
        status: 'pending',
      },
    });

    return orm ? this.toDomain(orm) : null;
  }

  async findPendingForInvitee(email: string, userId: string): Promise<Invitation[]> {
    const normalizedEmail = email.trim().toLowerCase();
    const orms = await this.repo
      .createQueryBuilder('invitation')
      .where('invitation.status = :status', { status: 'pending' })
      .andWhere(
        '(LOWER(invitation.invitee_email) = :email OR invitation.invitee_user_id = :userId)',
        { email: normalizedEmail, userId },
      )
      .orderBy('invitation.created_at', 'DESC')
      .getMany();

    return orms.map((orm) => this.toDomain(orm));
  }

  async createAndPublishInvited(data: {
    workspaceId: string;
    inviterId: string;
    inviteeEmail: string;
    inviteeUserId?: string | null;
    workspaceName?: string;
  }): Promise<Invitation> {
    return this.dataSource.transaction(async (manager) => {
      const orm = manager.create(InvitationOrmEntity, {
        workspace_id: data.workspaceId,
        inviter_id: data.inviterId,
        invitee_email: data.inviteeEmail,
        invitee_user_id: data.inviteeUserId?.trim() || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      const saved = await manager.save(orm);

      const recipientId = data.inviteeUserId?.trim();
      await this.workspaceOutboxService.enqueueWorkspaceInvited(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          invitationId: saved.id,
          workspaceId: saved.workspace_id,
          workspaceName: data.workspaceName,
          invitedById: saved.inviter_id,
          inviteEmail: saved.invitee_email,
          ...(recipientId ? { recipientId } : {}),
        },
        manager,
      );

      return this.toDomain(saved);
    });
  }

  async acceptAndJoinWorkspace(
    invitationId: string,
    userId: string,
  ): Promise<AcceptInvitationResult> {
    return this.dataSource.transaction(async (manager) => {
      const orm = await manager.findOne(InvitationOrmEntity, {
        where: { id: invitationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!orm) throw new NotFoundException('Invitation not found');
      const invitation = this.toDomain(orm);

      if (invitation.status === 'accepted' && invitation.inviteeUserId === userId) {
        return { status: 'accepted', workspaceId: orm.workspace_id, memberJoined: false };
      }

      try {
        invitation.assertCanAccept();
      } catch (error) {
        if (error instanceof InvitationInvalidStateError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const existingMember = await manager.findOne(WorkspaceMemberOrmEntity, {
        where: { workspace_id: orm.workspace_id, user_id: userId },
      });

      const existingAcceptedInvite = await manager.findOne(InvitationOrmEntity, {
        where: {
          invitee_email: orm.invitee_email,
          status: 'accepted',
          workspace_id: orm.workspace_id,
        },
      });

      if (existingAcceptedInvite && existingAcceptedInvite.id !== orm.id) {
        await manager.delete(InvitationOrmEntity, { id: orm.id });
      } else {
        orm.status = 'accepted';
        orm.invitee_user_id = userId;
        await manager.save(orm);
      }

      const memberJoined =
        existingMember == null &&
        (await this.insertMemberIfMissing(manager, {
          userId,
          workspaceId: orm.workspace_id,
        }));

      if (memberJoined) {
        await this.workspaceOutboxService.enqueueMemberJoined(
          {
            eventId: randomUUID(),
            occurredAt: new Date().toISOString(),
            invitationId,
            role: 'member',
            userId,
            workspaceId: orm.workspace_id,
          },
          manager,
        );
      }

      return { status: 'accepted', workspaceId: orm.workspace_id, memberJoined };
    });
  }

  async updateStatus(id: string, status: string, userId?: string): Promise<Invitation> {
    const orm = await this.repo.findOne({ where: { id } });
    if (!orm) throw new NotFoundException('Invitation not found');
    orm.status = status;
    if (userId !== undefined) orm.invitee_user_id = userId;
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  private async insertMemberIfMissing(
    manager: EntityManager,
    input: { userId: string; workspaceId: string },
  ): Promise<boolean> {
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(WorkspaceMemberOrmEntity)
      .values({
        role: 'member',
        user_id: input.userId,
        workspace_id: input.workspaceId,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    return Array.isArray(insertResult.raw) && insertResult.raw.length > 0;
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
