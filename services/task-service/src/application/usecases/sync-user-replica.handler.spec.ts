import { SyncUserReplicaHandler } from './sync-user-replica.handler';
import { SyncUserReplicaCommand } from '../commands/sync-user-replica.command';
import { IUserReplicaRepository } from '../ports/IUserReplicaRepository';

describe('SyncUserReplicaHandler', () => {
  let handler: SyncUserReplicaHandler;
  let mockUserReplicaRepo: jest.Mocked<IUserReplicaRepository>;

  beforeEach(() => {
    mockUserReplicaRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      upsertAsync: jest.fn(),
      updateFieldsAsync: jest.fn(),
    } as any;

    handler = new SyncUserReplicaHandler(mockUserReplicaRepo);
  });

  it('should sync user replica successfully', async () => {
    const command = new SyncUserReplicaCommand('user-123', 'Full Name', 'Display Name', 'Avatar URL');

    await handler.execute(command);

    expect(mockUserReplicaRepo.updateFieldsAsync).toHaveBeenCalledWith('user-123', {
      fullName: 'Full Name',
      displayName: 'Display Name',
      avatarUrl: 'Avatar URL',
    });
  });
});
