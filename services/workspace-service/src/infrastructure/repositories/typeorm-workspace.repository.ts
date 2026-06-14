import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workspace } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/repositories/workspace.repository';
import { WorkspaceOrmEntity } from '../database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../database/entities/workspace-member.orm-entity';
import { ProjectOrmEntity } from '../database/entities/project.orm-entity';
import { WorkspaceOutboxService } from '../outbox/workspace-outbox.service';
import { WorkspaceCacheService } from '../cache/workspace-cache.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TypeOrmWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly repo: Repository<WorkspaceOrmEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outboxService: WorkspaceOutboxService,
    private readonly cache: WorkspaceCacheService,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    const cached = await this.cache.getWorkspace(id);
    if (cached !== undefined) return cached;

    const orm = await this.repo.findOne({ where: { id } });
    const result = orm ? this.toDomain(orm) : null;
    if (result) await this.cache.setWorkspace(result);
    return result;
  }

  async adminListAll(): Promise<Array<Workspace & { memberCount: number }>> {
    const rows = await this.repo
      .createQueryBuilder('workspace')
      .loadRelationCountAndMap('workspace.memberCount', 'workspace.members')
      .orderBy('workspace.created_at', 'DESC')
      .getMany();
    return rows.map((row) =>
      Object.assign(this.toDomain(row), {
        memberCount: Number(
          (row as WorkspaceOrmEntity & { memberCount?: number }).memberCount ??
            0,
        ),
      }),
    );
  }

  async adminForceDelete(id: string, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const workspace = await manager.findOne(WorkspaceOrmEntity, {
        where: { id },
      });
      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }
      await manager.update(ProjectOrmEntity, { workspace_id: id }, { is_deleted: true });
      await manager.delete(WorkspaceMemberOrmEntity, { workspace_id: id });
      await manager.softDelete(WorkspaceOrmEntity, { id });
      await this.outboxService.enqueueWorkspaceDeleted(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          deletedById: actorId,
          workspaceId: id,
        },
        manager,
      );
    });
  }

  async adminForceJoin(
    id: string,
    userId: string,
    role: 'admin',
  ): Promise<void> {
    const workspace = await this.repo.findOne({ where: { id } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    const repository = this.dataSource.getRepository(WorkspaceMemberOrmEntity);
    await repository.upsert(
      {
        role,
        user_id: userId,
        workspace_id: id,
      },
      ['workspace_id', 'user_id'],
    );
  }

  async findByMember(userId: string): Promise<Workspace[]> {
    const cached = await this.cache.getWorkspaceList(userId);
    if (cached !== undefined) return cached;

    const orms = await this.repo
      .createQueryBuilder('workspace')
      .innerJoin('workspace.members', 'member', 'member.user_id = :userId', {
        userId,
      })
      .getMany();
    const result = orms.map((o) => this.toDomain(o));
    await this.cache.setWorkspaceList(userId, result);
    return result;
  }

  async createWithOwner(data: {
    name: string;
    description?: string;
    ownerId: string;
    userId: string;
  }): Promise<Workspace> {
    return this.dataSource.transaction(async (manager) => {
      const workspace = manager.create(WorkspaceOrmEntity, {
        name: data.name,
        description: data.description,
        owner_id: data.ownerId,
      });
      const saved = await manager.save(workspace);

      const member = manager.create(WorkspaceMemberOrmEntity, {
        workspace_id: saved.id,
        user_id: data.userId,
        role: 'owner',
      });
      await manager.save(member);

      const domainWorkspace = this.toDomain(saved);
      await this.cache.deleteWorkspaceList(data.userId);
      return domainWorkspace;
    });
  }

  async update(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Workspace> {
    const orm = await this.repo.findOne({ where: { id } });
    if (!orm) throw new NotFoundException('Workspace not found');
    if (data.name !== undefined) orm.name = data.name;
    if (data.description !== undefined) orm.description = data.description;
    const saved = await this.repo.save(orm);
    await this.cache.deleteWorkspace(id);
    return this.toDomain(saved);
  }

  private toDomain(orm: WorkspaceOrmEntity): Workspace {
    return new Workspace(
      orm.id,
      orm.name,
      orm.description,
      orm.owner_id,
      orm.created_at,
      orm.updated_at,
    );
  }
}
