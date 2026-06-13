import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsService } from '@/infrastructure/emails/emails.service';
import { DataSource } from 'typeorm';
import { AuthOutboxProcessor } from './auth-outbox.processor';
import { AuthOutboxService } from './auth-outbox.service';
import {
  AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
  AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
} from './entities/auth-outbox-event.entity';

describe('AuthOutboxProcessor', () => {
  const authOutboxServiceMock = {
    claimPendingBatch: jest.fn(),
    markFailed: jest.fn(),
    markProcessed: jest.fn(),
    reclaimStaleClaims: jest.fn(),
  } as unknown as AuthOutboxService;
  const configurationServiceMock = {
    getOutboxConfig: jest.fn(() => ({
      batchSize: 20,
      degradedFailedThreshold: 1,
      degradedPendingThreshold: 50,
      enabled: true,
      maxAttempts: 10,
      pollIntervalMs: 5000,
      staleClaimThresholdMs: 60000,
    })),
  } as unknown as ConfigurationService;
  const dataSourceMock = {
    isInitialized: true,
  } as unknown as DataSource;
  const emailsServiceMock = {
    sendMailNow: jest.fn(),
  } as unknown as EmailsService;

  let processor: AuthOutboxProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(authOutboxServiceMock, 'reclaimStaleClaims')
      .mockResolvedValue(0);
    processor = new AuthOutboxProcessor(
      authOutboxServiceMock,
      configurationServiceMock,
      dataSourceMock,
      emailsServiceMock,
    );
  });

  it('delivers verification otp emails through the outbox processor', async () => {
    jest.spyOn(authOutboxServiceMock, 'claimPendingBatch').mockResolvedValue([
      {
        attemptCount: 1,
        eventType: AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP,
        id: 'event-otp-1',
        payload: {
          email: 'member@example.com',
          otp: '123456',
          otpTtlSeconds: 600,
          userId: 'user-3',
        },
      },
    ]);
    jest.spyOn(emailsServiceMock, 'sendMailNow').mockResolvedValue({} as never);
    jest.spyOn(authOutboxServiceMock, 'markProcessed').mockResolvedValue(undefined);

    await processor.processPendingEvents();

    expect(emailsServiceMock.sendMailNow).toHaveBeenCalledWith({
      subject: 'Verify your CollabSpace email',
      text:
        'Your CollabSpace verification code is 123456. This code expires in 600 seconds.',
      to: 'member@example.com',
    });
    expect(authOutboxServiceMock.markProcessed).toHaveBeenCalledWith('event-otp-1');
  });

  it('delivers password reset emails through the outbox processor', async () => {
    jest.spyOn(authOutboxServiceMock, 'claimPendingBatch').mockResolvedValue([
      {
        attemptCount: 1,
        eventType: AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL,
        id: 'event-reset-1',
        payload: {
          email: 'member@example.com',
          token: 'reset-token-123',
          ttlSeconds: 1800,
          userId: 'user-4',
        },
      },
    ]);
    jest.spyOn(emailsServiceMock, 'sendMailNow').mockResolvedValue({} as never);
    jest.spyOn(authOutboxServiceMock, 'markProcessed').mockResolvedValue(undefined);

    await processor.processPendingEvents();

    expect(emailsServiceMock.sendMailNow).toHaveBeenCalledWith({
      subject: 'Reset your CollabSpace password',
      text:
        'Use this password reset token: reset-token-123. It expires in 1800 seconds.',
      to: 'member@example.com',
    });
    expect(authOutboxServiceMock.markProcessed).toHaveBeenCalledWith(
      'event-reset-1',
    );
  });
});
