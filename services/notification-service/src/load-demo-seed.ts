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
};

export type NotificationSeedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
};

export type NotificationSeedSample = {
  recipientId: string;
  actorId: string;
  type: string;
  title: string;
  message: string;
  targetId: string;
  targetType: string;
};

export const loadDemoSeedData = loader.loadDemoSeedData as () => {
  users: NotificationSeedUser[];
  demo: { sampleNotifications: NotificationSeedSample[] };
};
