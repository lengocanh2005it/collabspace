import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Project } from '../../domain/entities/project.entity';
import type { IProjectRepository } from '../../domain/repositories/project.repository';
import { ProjectOrmEntity } from '../database/entities/project.orm-entity';

@Injectable()
export class TypeOrmProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly repo: Repository<ProjectOrmEntity>,
  ) {}

  async findById(id: string, workspaceId: string): Promise<Project | null> {
    const orm = await this.repo.findOne({
      where: { id, workspace_id: workspaceId, is_deleted: false },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Project[]> {
    const orms = await this.repo.find({
      where: { workspace_id: workspaceId, is_deleted: false },
    });
    return orms.map((o) => this.toDomain(o));
  }

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    createdBy: string;
  }): Promise<Project> {
    const orm = this.repo.create({
      workspace_id: data.workspaceId,
      name: data.name,
      description: data.description,
      created_by: data.createdBy,
    });
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    data: { name?: string; description?: string },
  ): Promise<Project> {
    const orm = await this.repo.findOne({
      where: { id, workspace_id: workspaceId, is_deleted: false },
    });
    if (!orm) throw new NotFoundException('Project not found');
    if (data.name !== undefined) orm.name = data.name;
    if (data.description !== undefined) orm.description = data.description;
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    const orm = await this.repo.findOne({
      where: { id, workspace_id: workspaceId, is_deleted: false },
    });
    if (!orm) throw new NotFoundException('Project not found');
    orm.is_deleted = true;
    await this.repo.save(orm);
  }

  private toDomain(orm: ProjectOrmEntity): Project {
    return new Project(
      orm.id,
      orm.workspace_id,
      orm.name,
      orm.description,
      orm.created_by,
      orm.is_deleted,
      orm.created_at,
      orm.updated_at,
    );
  }
}
