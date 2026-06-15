import { EmailVerificationOtpService } from '@/application/services/email-verification-otp.service';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import type { EmailOutbox } from '@/domain/ports/email-outbox.port';
import { InMemoryUserRepository } from '@/infrastructure/repositories/in-memory-user.repository';
import type { ConfigurationService } from '@/configuration/configuration.service';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

describe('RegisterUseCase', () => {
  const configurationServiceMock = {
    getEmailVerificationConfig: jest.fn(() => ({
      otpLength: 6,
      otpTtlSeconds: 600,
      resendCooldownSeconds: 60,
      resendMaxAttempts: 5,
      resendWindowSeconds: 3600,
    })),
  } as unknown as ConfigurationService;

  const emailOutboxMock = {
    enqueueEmailVerificationOtp: jest.fn(),
    getDevOtp: jest.fn(),
    getStats: jest.fn(),
  } as unknown as EmailOutbox;

  const otpStoreMock = {
    assertAvailable: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    getJson: jest.fn(),
    increment: jest.fn(),
    ping: jest.fn(),
    set: jest.fn(),
    setJson: jest.fn(),
    ttl: jest.fn(),
  };

  const userProfileClientMock = {
    createPendingProfile: jest.fn(),
    getProfile: jest.fn(),
    ping: jest.fn(),
  };

  let userRepository: InMemoryUserRepository;
  let registerUseCase: RegisterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new InMemoryUserRepository();
    const emailVerificationOtpService = new EmailVerificationOtpService(
      configurationServiceMock,
      emailOutboxMock,
      otpStoreMock,
    );
    registerUseCase = new RegisterUseCase(
      userRepository,
      userProfileClientMock,
      emailVerificationOtpService,
    );
    jest.spyOn(otpStoreMock, 'assertAvailable').mockResolvedValue(undefined);
    jest.spyOn(otpStoreMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(emailOutboxMock, 'enqueueEmailVerificationOtp').mockResolvedValue(undefined);
  });

  it('registers a new user and queues verification email', async () => {
    jest.spyOn(userProfileClientMock, 'createPendingProfile').mockResolvedValue(undefined);

    const result = await registerUseCase.execute({
      email: 'new@collabspace.dev',
      fullName: 'New User',
      password: 'password123',
    });

    expect(result.verificationRequired).toBe(true);
    expect(result.email).toBe('new@collabspace.dev');
    expect(userProfileClientMock.createPendingProfile).toHaveBeenCalledWith({
      fullName: 'New User',
      userId: result.userId,
    });
    expect(emailOutboxMock.enqueueEmailVerificationOtp).toHaveBeenCalled();
  });

  it('rolls back a newly created auth user when profile bootstrap fails', async () => {
    jest.spyOn(userProfileClientMock, 'createPendingProfile').mockRejectedValue(
      new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User profiles gRPC client is not initialized',
      }),
    );

    await expect(
      registerUseCase.execute({
        email: 'rollback@collabspace.dev',
        fullName: 'Rollback User',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(userRepository.findUserByEmail('rollback@collabspace.dev')).resolves.toBeNull();
    expect(emailOutboxMock.enqueueEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('does not roll back when profile bootstrap fails for recovered pending user', async () => {
    await userRepository.register({
      email: 'pending@collabspace.dev',
      fullName: 'Pending User',
      password: 'password123',
    });

    jest.spyOn(userRepository, 'register').mockRejectedValue(
      new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
      }),
    );
    jest.spyOn(userProfileClientMock, 'createPendingProfile').mockRejectedValue(
      new ServiceUnavailableException({
        code: 'USER_SERVICE_GRPC_UNAVAILABLE',
        message: 'User service unavailable',
      }),
    );

    await expect(
      registerUseCase.execute({
        email: 'pending@collabspace.dev',
        fullName: 'Pending User',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(userRepository.findUserByEmail('pending@collabspace.dev')).resolves.toMatchObject({
      email: 'pending@collabspace.dev',
      emailVerified: false,
    });
  });
});
