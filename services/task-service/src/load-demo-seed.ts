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
  loadDemoSeedData: () => unknown;
  avatarUrlFor: (user: DemoSeedUser) => string;
  userSnapshot: (user: DemoSeedUser) => {
    userId: string;
    email: string;
    fullName: string;
    displayName: string;
    avatarUrl: string;
  };
};

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

export type DemoSeedTask = {
  id: string;
  title: string;
  description: string;
  status: "TODO" | "DOING" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  labels: string[];
  assigneeUserId: string | null;
  createdByUserId: string;
};

export type TaskSeedDemo = {
  workspaceId: string;
  projectId: string;
  tasks: DemoSeedTask[];
  sampleComment: {
    taskId: string;
    authorUserId: string;
    content: string;
    mentionUserIds: string[];
  };
};

export const loadDemoSeedData = loader.loadDemoSeedData as () => {
  users: DemoSeedUser[];
  demo: TaskSeedDemo;
};
export const avatarUrlFor = loader.avatarUrlFor;
export const userSnapshot = loader.userSnapshot;
