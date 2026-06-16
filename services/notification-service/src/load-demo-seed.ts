import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";

const nodeRequire = createRequire(__filename);

function resolveLoaderPath(): string {
  const candidates = [
    process.env.DEMO_SEED_LOADER_PATH,
    join(__dirname, "..", "..", "..", "scripts", "load-demo-seed-data.js"),
    join(__dirname, "..", "..", "..", "..", "scripts", "load-demo-seed-data.js"),
    "/app/scripts/load-demo-seed-data.js",
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "load-demo-seed-data.js not found. Set DEMO_SEED_LOADER_PATH or run from a built service image.",
  );
}

const loader = nodeRequire(resolveLoaderPath()) as {
  loadDemoSeedData: () => { defaultPassword: string; users: DemoSeedUser[] };
  collectDemoNotifications: (data: unknown) => DemoSeedNotification[];
  userReplicaDocumentFor: (user: DemoSeedUser) => {
    userId: string;
    email: string;
    username: string;
    fullName: string;
    displayName: string;
    avatarUrl: string;
    isActive: boolean;
  };
};

export type DemoSeedUser = {
  id: string;
  profileId?: string;
  email: string;
  username: string;
  fullName: string;
  avatarSeed?: string;
};

export type DemoSeedNotification = {
  recipientId: string;
  actorId: string;
  type: string;
  title: string;
  message: string;
  targetId: string;
  targetType: string;
  status?: "UNREAD" | "READ" | "ARCHIVED";
};

export const loadDemoSeedData = loader.loadDemoSeedData;
export const collectDemoNotifications = loader.collectDemoNotifications;
export const userReplicaDocumentFor = loader.userReplicaDocumentFor;
