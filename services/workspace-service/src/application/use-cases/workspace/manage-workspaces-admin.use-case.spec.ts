import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository';
import { ManageWorkspacesAdminUseCase } from './manage-workspaces-admin.use-case';

describe('ManageWorkspacesAdminUseCase', () => {
  const repository = {
    adminForceDelete: jest.fn(),
    adminForceJoin: jest.fn(),
    adminListAll: jest.fn(),
  } as unknown as jest.Mocked<IWorkspaceRepository>;
  const useCase = new ManageWorkspacesAdminUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('passes the actor into the transactional force delete', async () => {
    await useCase.forceDelete('admin-1', 'workspace-1');
    expect(repository.adminForceDelete).toHaveBeenCalledWith('workspace-1', 'admin-1');
  });

  it('force joins with the member workspace role', async () => {
    await useCase.forceJoin('admin-1', 'workspace-1', 'member', 'Investigating abuse');
    expect(repository.adminForceJoin).toHaveBeenCalledWith('workspace-1', 'admin-1', 'member');
  });
});
