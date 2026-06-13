import { WorkerUtils } from 'graphile-worker';
import { GraphileWorkerService } from './graphile-worker.service';

describe('GraphileWorkerService', () => {
  const workerUtilsMock = {
    addJob: jest.fn(),
    completeJobs: jest.fn(),
    migrate: jest.fn(),
    permanentlyFailJobs: jest.fn(),
    release: jest.fn(),
    rescheduleJobs: jest.fn(),
  } as unknown as WorkerUtils;

  let graphileWorkerService: GraphileWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    graphileWorkerService = new GraphileWorkerService(workerUtilsMock);
  });

  it('schedules a task through graphile worker', async () => {
    (workerUtilsMock.addJob as jest.Mock).mockResolvedValue({
      id: 1,
      task_identifier: 'send_email',
    });

    await expect(
      graphileWorkerService.schedule(
        'send_email',
        { email: 'user@example.com' },
        { queueName: 'emails' },
      ),
    ).resolves.toEqual({
      id: 1,
      task_identifier: 'send_email',
    });

    expect(workerUtilsMock.addJob).toHaveBeenCalledWith(
      'send_email',
      { email: 'user@example.com' },
      expect.objectContaining({ queueName: 'emails' }),
    );
  });
});
