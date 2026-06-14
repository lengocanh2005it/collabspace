import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BroadcastJobService } from '../../application/services/broadcast-job.service';
import { AuthGrpcService } from '../../integrations/auth/auth-grpc.service';
import { NotificationAdminController } from './notification-admin.controller';

describe('NotificationAdminController', () => {
  const authService = {
    verifyAccessToken: jest.fn(),
  } as unknown as jest.Mocked<AuthGrpcService>;
  const jobs = {
    enqueue: jest.fn(),
  } as unknown as jest.Mocked<BroadcastJobService>;
  const controller = new NotificationAdminController(authService, jobs);
  const body = {
    body: 'System maintenance',
    target: 'all' as const,
    title: 'Notice',
    type: 'system_broadcast' as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-admin identity', async () => {
    authService.verifyAccessToken.mockResolvedValue({
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
    } as never);

    await expect(
      controller.broadcast(body, 'Bearer member', 'key-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an idempotency key', async () => {
    authService.verifyAccessToken.mockResolvedValue({
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-1',
    } as never);

    await expect(
      controller.broadcast(body, 'Bearer admin', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enqueues an admin broadcast', async () => {
    authService.verifyAccessToken.mockResolvedValue({
      role: 'admin',
      roles: ['admin'],
      userId: 'admin-1',
    } as never);
    jobs.enqueue.mockResolvedValue({ id: 'job-1', status: 'pending' } as never);

    await controller.broadcast(body, 'Bearer admin', ' key-1 ');

    expect(jobs.enqueue).toHaveBeenCalledWith({
      actorId: 'admin-1',
      body: 'System maintenance',
      idempotencyKey: 'key-1',
      title: 'Notice',
    });
  });
});
