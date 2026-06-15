import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const nodeRequire = createRequire(__filename);

function resolveLoaderPath(): string {
  const candidates = [
    process.env.DEMO_SEED_LOADER_PATH,
    join(__dirname, '..', '..', '..', 'scripts', 'load-demo-seed-data.js'),
    join(__dirname, '..', '..', '..', '..', 'scripts', 'load-demo-seed-data.js'),
    '/app/scripts/load-demo-seed-data.js',
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'load-demo-seed-data.js not found. Set DEMO_SEED_LOADER_PATH or run from a built service image.',
  );
}

const loader = nodeRequire(resolveLoaderPath()) as {
  loadDemoSeedData: () => unknown;
};

export type WorkspaceSeedDemo = {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string;
  ownerUserId: string;
  members: Array<{ userId: string; role: string }>;
  projectId: string;
  projectName: string;
  projectDescription: string;
};

export const loadDemoSeedData = loader.loadDemoSeedData as () => {
  demo: WorkspaceSeedDemo;
  users: Array<{ id: string }>;
};
