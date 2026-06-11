import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workspace } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/repositories/workspace.repository';
import { WorkspaceOrmEntity } from '../database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../database/entities/workspace-member.orm-entity';

@Injectable()
export class TypeOrmWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly repo: Repository<WorkspaceOrmEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByMember(userId: string): Promise<Workspace[]> {
    const orms = await this.repo
      .createQueryBuilder('workspace')
      .innerJoin('workspace.members', 'member', 'member.user_id = :userId', {
        userId,
      })
      .getMany();
    return orms.map((o) => this.toDomain(o));
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

      return this.toDomain(saved);
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
