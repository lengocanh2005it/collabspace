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
  role: string;
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

export type DemoSeedData = {
  defaultPassword: string;
  users: DemoSeedUser[];
  demo: {
    workspaceId: string;
    workspaceName: string;
    workspaceDescription: string;
    ownerUserId: string;
    members: DemoSeedWorkspaceMember[];
    projectId: string;
    projectName: string;
    projectDescription: string;
    tasks: DemoSeedTask[];
    sampleComment: {
      taskId: string;
      authorUserId: string;
      content: string;
      mentionUserIds: string[];
    };
    sampleNotifications: Array<{
      recipientId: string;
      actorId: string;
      type: string;
      title: string;
      message: string;
      targetId: string;
      targetType: string;
    }>;
  };
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
