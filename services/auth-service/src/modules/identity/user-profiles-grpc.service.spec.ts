import { ConfigurationService } from '@/configuration/configuration.service';
import { TimeoutError, of, throwError } from 'rxjs';
import { UserProfilesGrpcService } from './user-profiles-grpc.service';

describe('UserProfilesGrpcService', () => {
  const createPendingProfileMock = jest.fn();
  const getProfileMock = jest.fn();
  const configurationServiceMock = {
    getUserServiceConfig: jest.fn(() => ({
      grpcTimeoutMs: 3000,
      grpcUrl: 'user-service:50052',
    })),
  } as unknown as ConfigurationService;
  const clientMock = {
    getService: jest.fn(() => ({
      createPendingProfile: createPendingProfileMock,
      getProfile: getProfileMock,
    })),
  };

  let service: UserProfilesGrpcService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserProfilesGrpcService(
      configurationServiceMock,
      clientMock as unknown,
    );
    service.onModuleInit();
  });

  it('returns a profile when user-service responds', async () => {
    getProfileMock.mockReturnValue(
      of({
        fullName: 'Member Example',
        userId: 'user-1',
      }),
    );

    await expect(
      service.getProfile({
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      fullName: 'Member Example',
      userId: 'user-1',
    });
  });

  it('maps user-service timeout errors to USER_SERVICE_GRPC_TIMEOUT', async () => {
    getProfileMock.mockReturnValue(
      throwError(() => new TimeoutError()),
    );

    await expect(
      service.getProfile({
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'USER_SERVICE_GRPC_TIMEOUT',
      }),
    });
  });

  it('maps user-service failures to USER_SERVICE_GRPC_REQUEST_FAILED', async () => {
    createPendingProfileMock.mockReturnValue(
      throwError(() => new Error('connection refused')),
    );

    await expect(
      service.createPendingProfile({
        fullName: 'Member Example',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'USER_SERVICE_GRPC_REQUEST_FAILED',
      }),
    });
  });
});
