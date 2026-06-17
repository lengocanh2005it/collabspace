import { buildRmqNestEnvelope, deserializeCollabspaceRmqMessage } from './rmq-nest-envelope';

describe('rmq-nest-envelope', () => {
  it('builds Nest-compatible emit envelopes', () => {
    const buffer = buildRmqNestEnvelope('workspace_invited', { workspaceId: 'ws-1' }, 'evt-1');
    expect(JSON.parse(buffer.toString())).toEqual({
      pattern: 'workspace_invited',
      data: { workspaceId: 'ws-1' },
      id: 'evt-1',
    });
  });

  it('deserializes Nest envelopes', () => {
    const body = JSON.stringify({
      pattern: 'task_assigned',
      data: { recipientId: 'u-1' },
      id: 'x',
    });

    expect(deserializeCollabspaceRmqMessage(body)).toEqual({
      pattern: 'task_assigned',
      data: { recipientId: 'u-1' },
    });
  });

  it('deserializes pre-parsed Nest envelope objects', () => {
    const envelope = {
      pattern: 'workspace_invited',
      data: { workspaceId: 'ws-1' },
      id: 'x',
    };

    expect(deserializeCollabspaceRmqMessage(envelope)).toEqual({
      pattern: 'workspace_invited',
      data: { workspaceId: 'ws-1' },
    });
  });

  it('falls back to routing key for legacy raw exchange payloads', () => {
    const body = JSON.stringify({ workspaceId: 'ws-1', inviteEmail: 'a@b.com' });

    expect(deserializeCollabspaceRmqMessage(body, 'workspace_invited')).toEqual({
      pattern: 'workspace_invited',
      data: { workspaceId: 'ws-1', inviteEmail: 'a@b.com' },
    });
  });
});
