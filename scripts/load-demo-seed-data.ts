import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DemoSeedUser = {
  id: string;
  profileId: string;
  email: string;
  fullName: string;
  username: string;
  roleNames: string[];
  bio: string;
  preferredLanguage: string;
  preferredTimezone: string;
  avatarSeed: string;
};

export type DemoSeedWorkspaceMember = {
  userId: string;
  role: 'owner' | 'manager' | 'member';
};

export type DemoSeedTask = {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'DOING' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  labels: string[];
  assigneeUserId: string | null;
  createdByUserId: string;
};

export type DemoSeedComment = {
  taskId: string;
  authorUserId: string;
  content: string;
  mentionUserIds: string[];
};

export type DemoSeedNotification = {
  recipientId: string;
  actorId: string;
  type: string;
  title: string;
  message: string;
  targetId: string;
  targetType: string;
  status?: 'UNREAD' | 'READ' | 'ARCHIVED';
};

export type DemoSeedPendingInvitation = {
  id: string;
  email: string;
  inviterUserId: string;
};

export type DemoSeedProject = {
  projectId: string;
  projectName: string;
  projectDescription: string;
  tasks: DemoSeedTask[];
  sampleComments?: DemoSeedComment[];
};

export type DemoSeedWorkspace = {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string;
  ownerUserId: string;
  members: DemoSeedWorkspaceMember[];
  projects: DemoSeedProject[];
  pendingInvitations?: DemoSeedPendingInvitation[];
  sampleNotifications?: DemoSeedNotification[];
};

/** @deprecated flat MVP shape — use workspaces[] */
export type DemoSeedLegacyDemo = {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string;
  ownerUserId: string;
  members: DemoSeedWorkspaceMember[];
  projectId: string;
  projectName: string;
  projectDescription: string;
  tasks: DemoSeedTask[];
  sampleComment?: DemoSeedComment;
  sampleNotifications?: DemoSeedNotification[];
};

export type DemoSeedDataMeta = {
  roleModel?: string;
  accountCount?: number;
  workspaceCount?: number;
  platformAdmins?: string[];
};

export type DemoSeedData = {
  _meta?: DemoSeedDataMeta;
  defaultPassword: string;
  users: DemoSeedUser[];
  workspaces?: DemoSeedWorkspace[];
  /** @deprecated use workspaces */
  demo?: DemoSeedLegacyDemo;
};

const DEMO_SEED_FILENAME = 'demo-seed-data.json';

export function loadDemoSeedData(): DemoSeedData {
  const candidates = [
    process.env.DEMO_SEED_DATA_PATH,
    join(__dirname, DEMO_SEED_FILENAME),
    join(process.cwd(), 'scripts', DEMO_SEED_FILENAME),
    join(process.cwd(), '..', '..', 'scripts', DEMO_SEED_FILENAME),
    '/app/scripts/demo-seed-data.json',
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as DemoSeedData;
    }
  }

  throw new Error(
    `Could not find ${DEMO_SEED_FILENAME}. Run seed scripts from the repository root or a service directory.`,
  );
}

function legacyDemoToWorkspace(demo: DemoSeedLegacyDemo): DemoSeedWorkspace {
  return {
    workspaceId: demo.workspaceId,
    workspaceName: demo.workspaceName,
    workspaceDescription: demo.workspaceDescription,
    ownerUserId: demo.ownerUserId,
    members: demo.members,
    projects: [
      {
        projectId: demo.projectId,
        projectName: demo.projectName,
        projectDescription: demo.projectDescription,
        tasks: demo.tasks,
        sampleComments: demo.sampleComment ? [demo.sampleComment] : [],
      },
    ],
    sampleNotifications: demo.sampleNotifications,
  };
}

export function getDemoWorkspaces(data: DemoSeedData): DemoSeedWorkspace[] {
  if (data.workspaces && data.workspaces.length > 0) {
    return data.workspaces;
  }
  if (data.demo) {
    return [legacyDemoToWorkspace(data.demo)];
  }
  throw new Error('demo-seed-data.json must define workspaces[] or legacy demo');
}

/** Primary MVP workspace (first entry). */
export function getPrimaryDemoWorkspace(data: DemoSeedData): DemoSeedWorkspace {
  return getDemoWorkspaces(data)[0];
}

export function collectDemoNotifications(data: DemoSeedData): DemoSeedNotification[] {
  return getDemoWorkspaces(data).flatMap((workspace) => workspace.sampleNotifications ?? []);
}

export function avatarUrlFor(user: DemoSeedUser): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${user.avatarSeed}`;
}

export function userSnapshot(user: DemoSeedUser) {
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    displayName: user.fullName,
    avatarUrl: avatarUrlFor(user),
  };
}

/** Mongo `user_replicas` document — task-service + notification-service seed the same shape. */
export function userReplicaDocumentFor(user: DemoSeedUser) {
  return {
    userId: user.id,
    email: user.email,
    username: user.username.toLowerCase(),
    fullName: user.fullName,
    displayName: user.fullName,
    avatarUrl: avatarUrlFor(user),
    isActive: true,
  };
}

/** What each service seed writes (canonical DB + local read-model replicas). */
export type SeedWriteTarget = {
  service: string;
  database: 'postgres' | 'mongodb';
  tables: string[];
  replicas?: string[];
};

export const SEED_WRITE_TARGETS: SeedWriteTarget[] = [
  {
    service: 'auth-service',
    database: 'postgres',
    tables: ['users', 'roles', 'permissions', 'user_roles', 'role_permissions'],
  },
  {
    service: 'user-service',
    database: 'postgres',
    tables: ['profiles', 'user_preferences', 'user_status'],
  },
  {
    service: 'workspace-service',
    database: 'postgres',
    tables: ['workspaces', 'workspace_members', 'projects', 'invitations'],
  },
  {
    service: 'task-service',
    database: 'mongodb',
    tables: ['tasks', 'task_events', 'task_comments', 'task_activity'],
    replicas: ['user_replicas'],
  },
  {
    service: 'notification-service',
    database: 'mongodb',
    tables: ['notifications'],
    replicas: ['user_replicas'],
  },
];

export function printSeedWriteTargets(): void {
  console.log('Seed writes (service DB + replicas):');
  for (const target of SEED_WRITE_TARGETS) {
    const replicaSuffix =
      target.replicas && target.replicas.length > 0
        ? `; replicas: ${target.replicas.join(', ')}`
        : '';
    console.log(`  ${target.service} [${target.database}]: ${target.tables.join(', ')}${replicaSuffix}`);
  }
}
