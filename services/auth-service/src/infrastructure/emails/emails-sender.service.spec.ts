import { ConfigurationService } from '@/configuration/configuration.service';
import { BrevoEmailClient } from './brevo-email.client';
import { EmailsSenderService } from './emails-sender.service';

jest.mock('./brevo-email.client');

describe('EmailsSenderService', () => {
  const sendTransactionalEmailMock = jest.fn();

  const buildService = (brevoConfig: Record<string, unknown>) => {
    (BrevoEmailClient as jest.Mock).mockImplementation(() => ({
      sendTransactionalEmail: sendTransactionalEmailMock,
    }));

    const configurationServiceMock = {
      getBrevoConfig: jest.fn(() => ({
        senderEmail: 'sender@example.com',
        senderName: 'CollabSpace',
        ...brevoConfig,
      })),
    } as unknown as ConfigurationService;

    return new EmailsSenderService(configurationServiceMock);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendTransactionalEmailMock.mockResolvedValue({ messageId: 'brevo-123' });
  });

  it('uses Brevo SDK when BREVO_API_KEY is configured', async () => {
    const service = buildService({ apiKey: 'xkeysib-test' });

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Verify',
      text: 'code 123',
    });

    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify',
        text: 'code 123',
      }),
      { email: 'sender@example.com', name: 'CollabSpace' },
    );
    expect(result.messageId).toBe('brevo-123');
  });

  it('does not call Brevo when API key is not configured (non-production)', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const service = buildService({ apiKey: '' });

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Verify',
      text: 'code 123',
    });

    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(result.messageId).toBe('mock');
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects mock send in production when API key is missing', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = buildService({ apiKey: '' });

    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Verify',
        text: 'code 123',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
      }),
    });

    process.env.NODE_ENV = originalNodeEnv;
  });
});
