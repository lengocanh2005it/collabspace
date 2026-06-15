import { ConfigurationService } from '@/configuration/configuration.service';
import { GraphileWorkerService } from '@/infrastructure/graphile-worker/graphile-worker.service';
import { EmailsSenderService } from './emails-sender.service';
import { EmailsService } from './emails.service';

describe('EmailsService', () => {
  const addJobMock = jest.fn();
  const normalizeOptionsMock = jest.fn();
  const sendMock = jest.fn();
  const configurationServiceMock = {
    getEmailConfig: jest.fn(() => ({
      deliveryTimeoutMs: 5000,
    })),
    getGraphileWorkerConfig: jest.fn(() => ({
      concurrency: 5,
      connectionString: 'postgresql://worker-db',
      enabled: true,
      pollInterval: 2000,
      schema: 'graphile_worker',
    })),
  } as unknown as ConfigurationService;
  const graphileWorkerServiceMock = {
    addJob: addJobMock,
  } as unknown as GraphileWorkerService;
  const emailsSenderServiceMock = {
    normalizeOptions: normalizeOptionsMock,
    send: sendMock,
  } as unknown as EmailsSenderService;

  let emailsService: EmailsService;

  beforeEach(() => {
    jest.clearAllMocks();
    normalizeOptionsMock.mockImplementation((options) => ({
      ...options,
      from: options.from ?? 'no-reply@collabspace.local',
    }));
    sendMock.mockResolvedValue({
      accepted: ['user@example.com'],
      messageId: 'message-id',
    });
    addJobMock.mockResolvedValue({
      id: 'job-1',
      task_identifier: 'emails.send',
    });
    emailsService = new EmailsService(
      emailsSenderServiceMock,
      configurationServiceMock,
      graphileWorkerServiceMock,
    );
  });

  it('queues text emails through graphile worker by default', async () => {
    await emailsService.sendText({
      subject: 'Verify account',
      text: 'hello',
      to: 'user@example.com',
    });

    expect(addJobMock).toHaveBeenCalledWith(
      'emails.send',
      {
        from: 'no-reply@collabspace.local',
        subject: 'Verify account',
        text: 'hello',
        to: 'user@example.com',
      },
      {
        queueName: 'emails',
      },
    );
  });

  it('keeps an explicit from address when provided', async () => {
    await emailsService.sendMail({
      from: 'support@collabspace.local',
      subject: 'Custom sender',
      text: 'hello',
      to: 'user@example.com',
    });

    expect(addJobMock).toHaveBeenCalledWith(
      'emails.send',
      {
        from: 'support@collabspace.local',
        subject: 'Custom sender',
        text: 'hello',
        to: 'user@example.com',
      },
      {
        queueName: 'emails',
      },
    );
  });

  it('sends html emails with optional text fallback', async () => {
    await emailsService.sendHtml({
      html: '<p>Hello</p>',
      subject: 'HTML mail',
      text: 'Hello',
      to: ['user@example.com'],
    });

    expect(addJobMock).toHaveBeenCalledWith(
      'emails.send',
      {
        from: 'no-reply@collabspace.local',
        html: '<p>Hello</p>',
        subject: 'HTML mail',
        text: 'Hello',
        to: ['user@example.com'],
      },
      {
        queueName: 'emails',
      },
    );
  });

  it('falls back to direct Brevo send when graphile worker is disabled', async () => {
    (
      configurationServiceMock.getGraphileWorkerConfig as jest.Mock
    ).mockReturnValue({
      concurrency: 5,
      connectionString: undefined,
      enabled: false,
      pollInterval: 2000,
      schema: 'graphile_worker',
    });

    await emailsService.sendText({
      subject: 'Direct send',
      text: 'hello',
      to: 'user@example.com',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'no-reply@collabspace.local',
      subject: 'Direct send',
      text: 'hello',
      to: 'user@example.com',
    });
  });

  it('maps direct email delivery timeouts to ServiceUnavailableException', async () => {
    (
      configurationServiceMock.getGraphileWorkerConfig as jest.Mock
    ).mockReturnValue({
      concurrency: 5,
      connectionString: undefined,
      enabled: false,
      pollInterval: 2000,
      schema: 'graphile_worker',
    });
    (
      configurationServiceMock.getEmailConfig as jest.Mock
    ).mockReturnValue({
      deliveryTimeoutMs: 1,
    });
    sendMock.mockImplementation(
      () => new Promise(() => undefined),
    );

    await expect(
      emailsService.sendText({
        subject: 'Timeout send',
        text: 'hello',
        to: 'user@example.com',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'EMAIL_DELIVERY_TIMEOUT',
      }),
    });
  });
});
