import { UserProfile } from '../../domain/entities/user-profile.entity';
import { toUserProfileResponseDto } from './user-profile-response.dto';

describe('toUserProfileResponseDto', () => {
  it('serializes Date timestamps to ISO strings', () => {
    const profile = new UserProfile(
      'profile-1',
      'user-1',
      'jane.doe',
      'Jane Doe',
      'Jane',
      null,
      null,
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(toUserProfileResponseDto(profile)).toMatchObject({
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      userId: 'user-1',
    });
  });

  it('accepts string timestamps from cache JSON revival', () => {
    const profile = {
      avatarUrl: null,
      bio: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      displayName: null,
      fullName: 'Jane Doe',
      id: 'profile-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      userId: 'user-1',
      username: 'jane.doe',
    } as UserProfile;

    expect(toUserProfileResponseDto(profile)).toMatchObject({
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });
});
