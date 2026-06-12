import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkspaceActivity,
  WorkspaceActivityType,
} from '../../domain/entities/workspace-activity.entity';
import { IWorkspaceActivityRepository } from '../../domain/repositories/workspace-activity.repository';
import { WorkspaceActivityOrmEntity } from '../database/entities/workspace-activity.orm-entity';

@Injectable()
export class TypeOrmWorkspaceActivityRepository implements IWorkspaceActivityRepository {
  constructor(
    @InjectRepository(WorkspaceActivityOrmEntity)
    private readonly repo: Repository<WorkspaceActivityOrmEntity>,
  ) {}

  async record(data: {
    workspaceId: string;
    actorId: string | null;
    actorName: string | null;
    type: WorkspaceActivityType;
    summary: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const entity = this.repo.create({
      workspace_id: data.workspaceId,
      actor_id: data.actorId,
      actor_name: data.actorName,
      type: data.type,
      summary: data.summary,
      meta: data.meta ?? {},
    });
    await this.repo.save(entity);
  }

  async findByWorkspace(
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: WorkspaceActivity[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [orms, total] = await this.repo.findAndCount({
      where: { workspace_id: workspaceId },
      order: { occurred_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { items: orms.map((o) => this.toDomain(o)), total };
  }

  private toDomain(orm: WorkspaceActivityOrmEntity): WorkspaceActivity {
    return new WorkspaceActivity(
      orm.id,
      orm.workspace_id,
      orm.actor_id,
      orm.actor_name,
      orm.type,
      orm.summary,
      orm.meta,
      orm.occurred_at,
    );
  }
}
