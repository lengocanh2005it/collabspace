import {
  WORKSPACE_DELETED_EVENT,
  WORKSPACE_INVITED_EVENT,
} from '../../domain/events/workspace-events';
import type { DataSource } from 'typeorm';
import type * as amqp from 'amqplib';
import {
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED,
  WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED,
} from './entities/workspace-outbox-event.entity';
import { WorkspaceOutboxProcessor } from './workspace-outbox.processor';
import type { WorkspaceOutboxService } from './workspace-outbox.service';

describe('WorkspaceOutboxProcessor', () => {
  const workspaceOutboxServiceMock = {
    claimPendingBatch: jest.fn(),
    markExhaustedClaims: jest.fn(),
    markFailed: jest.fn(),
    markProcessed: jest.fn(),
    reclaimStaleClaims: jest.fn(),
    releaseInFlightClaimsOnStartup: jest.fn(),
  } as unknown as WorkspaceOutboxService;
  const dataSourceMock = {
    isInitialized: true,
  } as unknown as DataSource;
  const rabbitChannelMock = {
    publish: jest.fn(),
  } as unknown as amqp.Channel;

  let processor: WorkspaceOutboxProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WORKSPACE_OUTBOX_PUBLISH_MODE = 'rabbitmq';
    jest.spyOn(workspaceOutboxServiceMock, 'markExhaustedClaims').mockResolvedValue(0);
    jest.spyOn(workspaceOutboxServiceMock, 'reclaimStaleClaims').mockResolvedValue(0);
    processor = new WorkspaceOutboxProcessor(
      dataSourceMock,
      workspaceOutboxServiceMock,
      rabbitChannelMock,
    );
  });

  it('publishes workspace invited events to RabbitMQ', async () => {
    const payload = {
      eventId: 'event-1',
      invitationId: 'inv-1',
      workspaceId: 'ws-1',
      inviteEmail: 'member@example.com',
    };
    jest.spyOn(workspaceOutboxServiceMock, 'claimPendingBatch').mockResolvedValue([
      {
        attemptCount: 1,
        eventType: WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED,
        id: 'outbox-1',
        payload,
      },
    ]);
    jest.spyOn(rabbitChannelMock, 'publish').mockReturnValue(true);
    jest.spyOn(workspaceOutboxServiceMock, 'markProcessed').mockResolvedValue(undefined);

    await processor.processPendingEvents();

    expect(rabbitChannelMock.publish).toHaveBeenCalledWith(
      'collabspace_exchange',
      WORKSPACE_INVITED_EVENT,
      expect.any(Buffer),
    );
    const invitedBuffer = (rabbitChannelMock.publish as jest.Mock).mock.calls[0][2] as Buffer;
    expect(JSON.parse(invitedBuffer.toString())).toMatchObject({
      pattern: WORKSPACE_INVITED_EVENT,
      data: payload,
    });
    expect(workspaceOutboxServiceMock.markProcessed).toHaveBeenCalledWith('outbox-1');
  });

  it('publishes workspace deleted events to RabbitMQ', async () => {
    const payload = {
      eventId: 'event-2',
      workspaceId: 'ws-2',
      deletedById: 'admin-1',
    };
    jest.spyOn(workspaceOutboxServiceMock, 'claimPendingBatch').mockResolvedValue([
      {
        attemptCount: 1,
        eventType: WORKSPACE_OUTBOX_EVENT_WORKSPACE_DELETED,
        id: 'outbox-2',
        payload,
      },
    ]);
    jest.spyOn(rabbitChannelMock, 'publish').mockReturnValue(true);
    jest.spyOn(workspaceOutboxServiceMock, 'markProcessed').mockResolvedValue(undefined);

    await processor.processPendingEvents();

    expect(rabbitChannelMock.publish).toHaveBeenCalledWith(
      'collabspace_exchange',
      WORKSPACE_DELETED_EVENT,
      expect.any(Buffer),
    );
    const deletedBuffer = (rabbitChannelMock.publish as jest.Mock).mock.calls[0][2] as Buffer;
    expect(JSON.parse(deletedBuffer.toString())).toMatchObject({
      pattern: WORKSPACE_DELETED_EVENT,
      data: payload,
    });
    expect(workspaceOutboxServiceMock.markProcessed).toHaveBeenCalledWith('outbox-2');
  });

  it('does not poll RabbitMQ when publish mode is debezium', async () => {
    const originalMode = process.env.WORKSPACE_OUTBOX_PUBLISH_MODE;
    process.env.WORKSPACE_OUTBOX_PUBLISH_MODE = 'debezium';
    try {
      const debeziumProcessor = new WorkspaceOutboxProcessor(
        dataSourceMock,
        workspaceOutboxServiceMock,
        null,
      );

      await debeziumProcessor.onModuleInit();

      expect(rabbitChannelMock.publish).not.toHaveBeenCalled();
      expect(workspaceOutboxServiceMock.claimPendingBatch).not.toHaveBeenCalled();
    } finally {
      if (originalMode === undefined) {
        delete process.env.WORKSPACE_OUTBOX_PUBLISH_MODE;
      } else {
        process.env.WORKSPACE_OUTBOX_PUBLISH_MODE = originalMode;
      }
    }
  });

  it('marks unsupported event types as failed', async () => {
    jest.spyOn(workspaceOutboxServiceMock, 'claimPendingBatch').mockResolvedValue([
      {
        attemptCount: 2,
        eventType: 'workspace.unknown',
        id: 'outbox-3',
        payload: {},
      },
    ]);
    jest.spyOn(workspaceOutboxServiceMock, 'markFailed').mockResolvedValue(undefined);

    await processor.processPendingEvents();

    expect(rabbitChannelMock.publish).not.toHaveBeenCalled();
    expect(workspaceOutboxServiceMock.markFailed).toHaveBeenCalledWith(
      'outbox-3',
      2,
      expect.stringContaining('Unsupported workspace outbox event type'),
    );
  });
});
