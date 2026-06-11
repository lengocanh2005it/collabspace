import { Project } from '../entities/project.entity';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface IProjectRepository {
  findById(id: string, workspaceId: string): Promise<Project | null>;
  findByWorkspace(workspaceId: string): Promise<Project[]>;
  create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    createdBy: string;
  }): Promise<Project>;
  update(
    id: string,
    workspaceId: string,
    data: { name?: string; description?: string },
  ): Promise<Project>;
  softDelete(id: string, workspaceId: string): Promise<void>;
}
