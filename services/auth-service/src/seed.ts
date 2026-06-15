import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { DataSource } from 'typeorm';
import { PermissionOrmEntity } from './infrastructure/database/entities/permission.orm-entity';
import { RolePermissionOrmEntity } from './infrastructure/database/entities/role-permission.orm-entity';
import { RoleOrmEntity } from './infrastructure/database/entities/role.orm-entity';
import { UserRoleOrmEntity } from './infrastructure/database/entities/user-role.orm-entity';
import { UserOrmEntity } from './infrastructure/database/entities/user.orm-entity';
import { loadDemoSeedData, type DemoSeedUser } from './load-demo-seed';

type SeedPermission = {
  description: string;
  id: string;
  name: string;
};

type SeedRole = {
  description: string;
  id: string;
  name: string;
  permissionNames: string[];
};

type SeedUser = {
  email: string;
  fullName: string;
  id: string;
  password: string;
  roleNames: string[];
};

function mapDemoUsers(
  users: DemoSeedUser[],
  defaultPassword: string,
): SeedUser[] {
  return users.map((user) => ({
    email: user.email,
    fullName: user.fullName,
    id: user.id,
    password: defaultPassword,
    roleNames: user.roleNames,
  }));
}

const scryptAsync = promisify(scrypt);

const SEED_PERMISSIONS: SeedPermission[] = [
  {
    description: 'Manage authentication and RBAC settings',
    id: '81000000-0000-4000-8000-000000000001',
    name: 'auth.manage',
  },
  {
    description: 'Read user profiles and account information',
    id: '81000000-0000-4000-8000-000000000002',
    name: 'users.read',
  },
  {
    description: 'Update user profiles and account information',
    id: '81000000-0000-4000-8000-000000000003',
    name: 'users.write',
  },
  {
    description: 'Read workspace metadata',
    id: '81000000-0000-4000-8000-000000000004',
    name: 'workspaces.read',
  },
  {
    description: 'Create and manage workspaces',
    id: '81000000-0000-4000-8000-000000000005',
    name: 'workspaces.write',
  },
  {
    description: 'Read tasks and task comments',
    id: '81000000-0000-4000-8000-000000000006',
    name: 'tasks.read',
  },
  {
    description: 'Create and update tasks',
    id: '81000000-0000-4000-8000-000000000007',
    name: 'tasks.write',
  },
  {
    description: 'Read notification inbox data',
    id: '81000000-0000-4000-8000-000000000008',
    name: 'notifications.read',
  },
];

const SEED_ROLES: SeedRole[] = [
  {
    description: 'Platform administrator with full system access',
    id: '82000000-0000-4000-8000-000000000001',
    name: 'admin',
    permissionNames: SEED_PERMISSIONS.map((permission) => permission.name),
  },
  {
    description: 'Standard collaborator using workspaces and tasks',
    id: '82000000-0000-4000-8000-000000000002',
    name: 'member',
    permissionNames: [
      'users.read',
      'users.write',
      'workspaces.read',
      'workspaces.write',
      'tasks.read',
      'tasks.write',
      'notifications.read',
    ],
  },
  {
    description: 'Read-only stakeholder for demos and reviews',
    id: '82000000-0000-4000-8000-000000000003',
    name: 'viewer',
    permissionNames: [
      'users.read',
      'workspaces.read',
      'tasks.read',
      'notifications.read',
    ],
  },
];

const demoData = loadDemoSeedData();
const DEFAULT_PASSWORD = demoData.defaultPassword;

const SEED_USERS: SeedUser[] = mapDemoUsers(demoData.users, DEFAULT_PASSWORD);

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run auth-service seed');
  }

  return databaseUrl;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function seedRoles(
  dataSource: DataSource,
): Promise<Map<string, RoleOrmEntity>> {
  const roleRepository = dataSource.getRepository(RoleOrmEntity);
  const rolesByName = new Map<string, RoleOrmEntity>();

  for (const seedRole of SEED_ROLES) {
    const existingRole = await roleRepository.findOne({
      where: {
        name: seedRole.name,
      },
    });

    const role = await roleRepository.save(
      roleRepository.create({
        description: seedRole.description,
        id: existingRole?.id ?? seedRole.id,
        name: seedRole.name,
      }),
    );

    rolesByName.set(role.name, role);
  }

  return rolesByName;
}

async function seedPermissions(
  dataSource: DataSource,
): Promise<Map<string, PermissionOrmEntity>> {
  const permissionRepository = dataSource.getRepository(PermissionOrmEntity);
  const permissionsByName = new Map<string, PermissionOrmEntity>();

  for (const seedPermission of SEED_PERMISSIONS) {
    const existingPermission = await permissionRepository.findOne({
      where: {
        name: seedPermission.name,
      },
    });

    const permission = await permissionRepository.save(
      permissionRepository.create({
        description: seedPermission.description,
        id: existingPermission?.id ?? seedPermission.id,
        name: seedPermission.name,
      }),
    );

    permissionsByName.set(permission.name, permission);
  }

  return permissionsByName;
}

async function seedRolePermissions(
  dataSource: DataSource,
  rolesByName: Map<string, RoleOrmEntity>,
  permissionsByName: Map<string, PermissionOrmEntity>,
): Promise<void> {
  const rolePermissionRepository = dataSource.getRepository(
    RolePermissionOrmEntity,
  );

  for (const seedRole of SEED_ROLES) {
    const role = rolesByName.get(seedRole.name);

    if (!role) {
      throw new Error(
        `Missing role ${seedRole.name} during role permission seed`,
      );
    }

    for (const permissionName of seedRole.permissionNames) {
      const permission = permissionsByName.get(permissionName);

      if (!permission) {
        throw new Error(`Missing permission ${permissionName} during seed`);
      }

      const existingRolePermission = await rolePermissionRepository.findOne({
        where: {
          permissionId: permission.id,
          roleId: role.id,
        },
      });

      if (!existingRolePermission) {
        await rolePermissionRepository.save(
          rolePermissionRepository.create({
            permissionId: permission.id,
            roleId: role.id,
          }),
        );
      }
    }
  }
}

async function seedUsers(
  dataSource: DataSource,
  rolesByName: Map<string, RoleOrmEntity>,
): Promise<void> {
  const userRepository = dataSource.getRepository(UserOrmEntity);
  const userRoleRepository = dataSource.getRepository(UserRoleOrmEntity);

  for (const seedUser of SEED_USERS) {
    const existingByEmail = await userRepository.findOne({
      where: {
        email: seedUser.email,
      },
      withDeleted: true,
    });

    if (existingByEmail && existingByEmail.id !== seedUser.id) {
      throw new Error(
        `User ${seedUser.email} already exists with different id ${existingByEmail.id}. Reset the auth DB before applying shared seeds.`,
      );
    }

    const user = await userRepository.save(
      userRepository.create({
        deletedAt: null,
        email: seedUser.email,
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        id: seedUser.id,
        isActive: true,
        lastLoginAt: null,
        passwordHash: await hashPassword(seedUser.password),
      }),
    );

    for (const roleName of seedUser.roleNames) {
      const role = rolesByName.get(roleName);

      if (!role) {
        throw new Error(`Missing role ${roleName} during user role seed`);
      }

      const existingUserRole = await userRoleRepository.findOne({
        where: {
          roleId: role.id,
          userId: user.id,
        },
      });

      if (!existingUserRole) {
        await userRoleRepository.save(
          userRoleRepository.create({
            roleId: role.id,
            userId: user.id,
          }),
        );
      }
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile();

  const dataSource = new DataSource({
    entities: [
      UserOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      UserRoleOrmEntity,
      RolePermissionOrmEntity,
    ],
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: toBoolean(process.env.DATABASE_SSL, false)
      ? { rejectUnauthorized: false }
      : false,
    synchronize: false,
    type: 'postgres',
    url: requireDatabaseUrl(),
  });

  await dataSource.initialize();

  try {
    const permissionsByName = await seedPermissions(dataSource);
    const rolesByName = await seedRoles(dataSource);
    await seedRolePermissions(dataSource, rolesByName, permissionsByName);
    await seedUsers(dataSource, rolesByName);

    console.log('auth-service seed completed');
    console.table(
      SEED_USERS.map((user) => ({
        email: user.email,
        name: user.fullName,
        password: '***',
        roles: user.roleNames.join(','),
      })),
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('auth-service seed failed');
  console.error(error);
  process.exitCode = 1;
});
