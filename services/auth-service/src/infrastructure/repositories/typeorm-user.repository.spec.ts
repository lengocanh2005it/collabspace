import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import type { Repository } from 'typeorm';
import { TypeOrmUserRepository } from './typeorm-user.repository';
import type { RoleOrmEntity } from '@/infrastructure/database/entities/role.orm-entity';
import type { UserRoleOrmEntity } from '@/infrastructure/database/entities/user-role.orm-entity';
import type { UserOrmEntity } from '@/infrastructure/database/entities/user.orm-entity';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function buildAuthUserOrmEntity(overrides: Partial<UserOrmEntity> = {}): UserOrmEntity {
  return {
    id: 'user-1',
    email: 'member@example.com',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    isActive: true,
    deletedAt: null,
    passwordHash: '',
    userRoles: [
      {
        role: {
          name: 'member',
          rolePermissions: [{ permission: { name: 'users.read' } }],
        },
      },
    ],
    ...overrides,
  } as UserOrmEntity;
}

describe('TypeOrmUserRepository', () => {
  const roleRepositoryMock = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<RoleOrmEntity>;

  const userRepositoryMock = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as Repository<UserOrmEntity>;

  const userRoleRepositoryMock = {
    create: jest.fn((value) => value),
    delete: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<UserRoleOrmEntity>;

  let userRepository: TypeOrmUserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new TypeOrmUserRepository(
      roleRepositoryMock,
      userRepositoryMock,
      userRoleRepositoryMock,
    );
  });

  it('rejects invalid email on register', async () => {
    await expect(
      userRepository.register({
        email: 'not-an-email',
        fullName: 'Member Example',
        password: 'password123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate email on register', async () => {
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue({
      id: 'existing',
      deletedAt: null,
    });

    await expect(
      userRepository.register({
        email: 'member@example.com',
        fullName: 'Member Example',
        password: 'password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns auth user by id', async () => {
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(buildAuthUserOrmEntity());

    await expect(userRepository.getAuthUserById('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      email: 'member@example.com',
      emailVerified: true,
      role: 'member',
    });
  });

  it('throws when auth user is not found', async () => {
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(null);

    await expect(userRepository.getAuthUserById('missing')).rejects.toThrow(NotFoundException);
  });

  it('validates credentials for a verified active user', async () => {
    const password = 'password123';
    const user = buildAuthUserOrmEntity({
      passwordHash: await hashPassword(password),
    });
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(user);

    await expect(
      userRepository.validateCredentials({
        email: 'member@example.com',
        password,
      }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      emailVerified: true,
    });
  });

  it('rejects login when email is not verified', async () => {
    const password = 'password123';
    const user = buildAuthUserOrmEntity({
      emailVerifiedAt: null,
      passwordHash: await hashPassword(password),
    });
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(user);

    await expect(
      userRepository.validateCredentials({
        email: 'member@example.com',
        password,
      }),
    ).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
    await expect(
      userRepository.validateCredentials({
        email: 'member@example.com',
        password,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects change password when current password is invalid', async () => {
    const user = buildAuthUserOrmEntity({
      passwordHash: await hashPassword('password123'),
    });
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(user);

    await expect(
      userRepository.changePassword('user-1', 'wrong-password', 'newpassword1'),
    ).rejects.toMatchObject({
      response: { code: 'PASSWORD_INVALID' },
    });
  });

  it('marks email verified when pending verification', async () => {
    const user = buildAuthUserOrmEntity({ emailVerifiedAt: null });
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue(user);
    (userRepositoryMock.save as jest.Mock).mockImplementation(async (value) => value);

    await expect(userRepository.markEmailVerified('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      emailVerified: true,
    });
    expect(userRepositoryMock.save).toHaveBeenCalled();
  });

  it('rolls back unverified registration', async () => {
    (userRepositoryMock.findOne as jest.Mock).mockResolvedValue({
      id: 'user-1',
      deletedAt: null,
      emailVerifiedAt: null,
    });

    await userRepository.rollbackNewRegistration('user-1');

    expect(userRoleRepositoryMock.delete).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(userRepositoryMock.softDelete).toHaveBeenCalledWith({
      id: 'user-1',
    });
  });
});
