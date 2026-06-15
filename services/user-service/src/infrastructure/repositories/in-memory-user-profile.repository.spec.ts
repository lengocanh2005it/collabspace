import { randomUUID } from 'node:crypto';
import { InMemoryUserProfileRepository } from './in-memory-user-profile.repository';

describe('InMemoryUserProfileRepository', () => {
  let repository: InMemoryUserProfileRepository;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
  });

  it('assigns a suffixed username when the base username is already taken', async () => {
    const existingUserId = randomUUID();
    const now = new Date();
    await repository.upsertPending({
      fullName: 'Le Ngoc Anh',
      userId: existingUserId,
    });

    const newUserId = randomUUID();
    const profile = await repository.upsertPending({
      fullName: 'Le Ngoc Anh',
      userId: newUserId,
    });

    expect(profile.username).toBe('le.ngoc.anh-2');
    expect(profile.userId).toBe(newUserId);

    const existing = await repository.findByUserId(existingUserId);
    expect(existing?.username).toBe('le.ngoc.anh');
  });

  it('keeps the existing username when upserting the same pending user', async () => {
    const userId = randomUUID();
    const created = await repository.upsertPending({
      fullName: 'Le Ngoc Anh',
      userId,
    });

    const updated = await repository.upsertPending({
      fullName: 'Le Ngoc Anh Updated',
      userId,
    });

    expect(updated.username).toBe(created.username);
    expect(updated.fullName).toBe('Le Ngoc Anh Updated');
  });
});
