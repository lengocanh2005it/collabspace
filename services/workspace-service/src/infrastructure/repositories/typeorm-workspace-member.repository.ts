import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { normalizeWorkspaceRole } from '@collabspace/shared';
import type { Repository } from 'typeorm';
import { WorkspaceMember } from '../../domain/entities/workspace-member.entity';
import type { IWorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';
import { WorkspaceMemberOrmEntity } from '../database/entities/workspace-member.orm-entity';

@Injectable()
export class TypeOrmWorkspaceMemberRepository implements IWorkspaceMemberRepository {
  constructor(
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly repo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const orm = await this.repo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const orms = await this.repo.find({ where: { workspace_id: workspaceId } });
    return orms.map((o) => this.toDomain(o));
  }

  async removeByWorkspaceAndUser(workspaceId: string, userId: string): Promise<void> {
    const result = await this.repo.delete({ workspace_id: workspaceId, user_id: userId });
    if (!result.affected) {
      throw new NotFoundException('Workspace member not found');
    }
  }

  async updateRoleByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    const result = await this.repo.update({ workspace_id: workspaceId, user_id: userId }, { role });

    if (!result.affected) {
      throw new NotFoundException('Workspace member not found');
    }
  }

  async countByWorkspaceAndRole(workspaceId: string, role: string): Promise<number> {
    return this.repo.count({ where: { workspace_id: workspaceId, role } });
  }

  private toDomain(orm: WorkspaceMemberOrmEntity): WorkspaceMember {
    return new WorkspaceMember(
      orm.id,
      orm.workspace_id,
      orm.user_id,
      normalizeWorkspaceRole(orm.role),
      orm.joined_at,
    );
  }
}
