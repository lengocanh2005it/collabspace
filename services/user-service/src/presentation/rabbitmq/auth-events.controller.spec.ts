import { AuthEventsController } from './auth-events.controller';

describe('AuthEventsController', () => {
  it('delegates auth email verified events to VerifyUserProfileEmailUseCase', async () => {
    const verifyUserProfileEmailUseCase = {
      execute: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    const controller = new AuthEventsController(
      verifyUserProfileEmailUseCase as never,
    );

    await controller.handleAuthEmailVerified({
      email: 'jane@example.com',
      userId: 'user-1',
      verifiedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(verifyUserProfileEmailUseCase.execute).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
