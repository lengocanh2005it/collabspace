import { ConfigurationService } from '@/configuration/configuration.service';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailsSenderService } from './emails-sender.service';

describe('EmailsSenderService', () => {
  const sendMailMock = jest.fn();
  const mailerServiceMock = {
    sendMail: sendMailMock,
  } as unknown as MailerService;

  const buildService = (emailConfig: Record<string, unknown>) => {
    const configurationServiceMock = {
      getEmailConfig: jest.fn(() => ({
        from: 'no-reply@collabspace.local',
        deliveryTimeoutMs: 5000,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        ignoreTls: false,
        ...emailConfig,
      })),
    } as unknown as ConfigurationService;

    return new EmailsSenderService(mailerServiceMock, configurationServiceMock);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockResolvedValue({
      accepted: ['user@example.com'],
      messageId: 'smtp-id',
    });
  });

  it('uses MailerService when SMTP credentials are configured', async () => {
    const service = buildService({
      user: 'sender@gmail.com',
      password: 'app-password',
    });

    await service.send({
      to: 'user@example.com',
      subject: 'Verify',
      text: 'code 123',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify',
        text: 'code 123',
      }),
    );
  });

  it('does not call MailerService when SMTP is not configured', async () => {
    const service = buildService({ user: '', password: '' });

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Verify',
      text: 'code 123',
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(result.messageId).toBe('mock');
  });
});
