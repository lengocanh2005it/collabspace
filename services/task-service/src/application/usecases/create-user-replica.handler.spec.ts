import { CreateUserReplicaHandler } from './create-user-replica.handler';
import { CreateUserReplicaCommand } from '../commands/create-user-replica.command';
import { IUserReplicaRepository } from '../ports/IUserReplicaRepository';

describe('CreateUserReplicaHandler', () => {
  let handler: CreateUserReplicaHandler;
  let mockUserReplicaRepo: jest.Mocked<IUserReplicaRepository>;

  beforeEach(() => {
    mockUserReplicaRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      upsertAsync: jest.fn(),
      updateFieldsAsync: jest.fn(),
    } as any;

    handler = new CreateUserReplicaHandler(mockUserReplicaRepo);
  });

  it('should create user replica successfully', async () => {
    const command = new CreateUserReplicaCommand('user-123', 'Full Name');

    await handler.execute(command);

    expect(mockUserReplicaRepo.upsertAsync).toHaveBeenCalledWith({
      userId: 'user-123',
      fullName: 'Full Name',
      isActive: true,
    });
  });
});
