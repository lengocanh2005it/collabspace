import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { WorkspaceOrmEntity } from './infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from './infrastructure/database/entities/workspace-member.orm-entity';
import { ProjectOrmEntity } from './infrastructure/database/entities/project.orm-entity';
import { InvitationOrmEntity } from './infrastructure/database/entities/invitation.orm-entity';
import { loadDemoSeedData } from './load-demo-seed';

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

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run workspace-service seed');
  }

  return databaseUrl;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function main(): Promise<void> {
  loadEnvFile();

  const { demo } = loadDemoSeedData();
  const dataSource = new DataSource({
    type: 'postgres',
    url: requireDatabaseUrl(),
    schema: process.env.DATABASE_SCHEMA || 'public',
    entities: [
      WorkspaceOrmEntity,
      WorkspaceMemberOrmEntity,
      ProjectOrmEntity,
      InvitationOrmEntity,
    ],
    synchronize: toBoolean(process.env.DATABASE_SYNCHRONIZE, false),
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
  });

  await dataSource.initialize();

  try {
    const workspaceRepo = dataSource.getRepository(WorkspaceOrmEntity);
    const memberRepo = dataSource.getRepository(WorkspaceMemberOrmEntity);
    const projectRepo = dataSource.getRepository(ProjectOrmEntity);

    let workspace = await workspaceRepo.findOne({
      where: { id: demo.workspaceId },
    });

    if (!workspace) {
      workspace = workspaceRepo.create({
        id: demo.workspaceId,
        name: demo.workspaceName,
        description: demo.workspaceDescription,
        owner_id: demo.ownerUserId,
      });
    } else {
      workspace.name = demo.workspaceName;
      workspace.description = demo.workspaceDescription;
      workspace.owner_id = demo.ownerUserId;
    }

    await workspaceRepo.save(workspace);

    for (const member of demo.members) {
      const existingMember = await memberRepo.findOne({
        where: {
          workspace_id: demo.workspaceId,
          user_id: member.userId,
        },
      });

      if (existingMember) {
        existingMember.role = member.role;
        await memberRepo.save(existingMember);
        continue;
      }

      await memberRepo.save(
        memberRepo.create({
          workspace_id: demo.workspaceId,
          user_id: member.userId,
          role: member.role,
        }),
      );
    }

    let project = await projectRepo.findOne({
      where: { id: demo.projectId },
    });

    if (!project) {
      project = projectRepo.create({
        id: demo.projectId,
        workspace_id: demo.workspaceId,
        name: demo.projectName,
        description: demo.projectDescription,
        created_by: demo.ownerUserId,
        is_deleted: false,
      });
    } else {
      project.name = demo.projectName;
      project.description = demo.projectDescription;
      project.workspace_id = demo.workspaceId;
      project.created_by = demo.ownerUserId;
      project.is_deleted = false;
    }

    await projectRepo.save(project);

    console.log('workspace-service seed completed');
    console.table([
      {
        workspaceId: demo.workspaceId,
        workspaceName: demo.workspaceName,
        projectId: demo.projectId,
        projectName: demo.projectName,
        memberCount: demo.members.length,
      },
    ]);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('workspace-service seed failed');
  console.error(error);
  process.exitCode = 1;
});
