import type { DataSource } from 'typeorm';
import { WorkspaceOutboxProcessor } from './workspace-outbox.processor';
import type { WorkspaceOutboxService } from './workspace-outbox.service';

describe('WorkspaceOutboxProcessor', () => {
  const workspaceOutboxServiceMock = {
    releaseInFlightClaimsOnStartup: jest.fn(),
  } as unknown as WorkspaceOutboxService;
  const dataSourceMock = {
    isInitialized: true,
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(workspaceOutboxServiceMock, 'releaseInFlightClaimsOnStartup').mockResolvedValue(0);
  });

  it('releases in-flight claims on startup in Debezium mode', async () => {
    const processor = new WorkspaceOutboxProcessor(dataSourceMock, workspaceOutboxServiceMock);

    await processor.onModuleInit();
    await processor.bootstrapOutboxProcessing();

    expect(workspaceOutboxServiceMock.releaseInFlightClaimsOnStartup).toHaveBeenCalled();
  });
});
