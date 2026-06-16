import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWorkspaceRole } from '@collabspace/shared';
import { DataSource, type Repository } from 'typeorm';
import { WorkspaceOrmEntity } from './infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from './infrastructure/database/entities/workspace-member.orm-entity';
import { ProjectOrmEntity } from './infrastructure/database/entities/project.orm-entity';
import { InvitationOrmEntity } from './infrastructure/database/entities/invitation.orm-entity';
import {
  getDemoWorkspaces,
  loadDemoSeedData,
  type DemoSeedPendingInvitation,
  type DemoSeedWorkspace,
} from './load-demo-seed';

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

async function seedPendingInvitations(
  workspaceId: string,
  invitations: DemoSeedPendingInvitation[],
  invitationRepo: Repository<InvitationOrmEntity>,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (const invitation of invitations) {
    let row = await invitationRepo.findOne({ where: { id: invitation.id } });

    if (!row) {
      row = invitationRepo.create({ id: invitation.id });
    }

    row.workspace_id = workspaceId;
    row.inviter_id = invitation.inviterUserId;
    row.invitee_email = invitation.email.toLowerCase();
    row.invitee_user_id = null;
    row.status = 'pending';
    row.expires_at = expiresAt;
    await invitationRepo.save(row);
  }
}

async function seedWorkspaceBundle(
  workspaceSeed: DemoSeedWorkspace,
  workspaceRepo: Repository<WorkspaceOrmEntity>,
  memberRepo: Repository<WorkspaceMemberOrmEntity>,
  projectRepo: Repository<ProjectOrmEntity>,
  invitationRepo: Repository<InvitationOrmEntity>,
): Promise<{
  workspaceId: string;
  workspaceName: string;
  projectCount: number;
  memberCount: number;
}> {
  let workspace = await workspaceRepo.findOne({
    where: { id: workspaceSeed.workspaceId },
  });

  if (!workspace) {
    workspace = workspaceRepo.create({
      id: workspaceSeed.workspaceId,
      name: workspaceSeed.workspaceName,
      description: workspaceSeed.workspaceDescription,
      owner_id: workspaceSeed.ownerUserId,
    });
  } else {
    workspace.name = workspaceSeed.workspaceName;
    workspace.description = workspaceSeed.workspaceDescription;
    workspace.owner_id = workspaceSeed.ownerUserId;
  }

  await workspaceRepo.save(workspace);

  await memberRepo.update(
    { workspace_id: workspaceSeed.workspaceId, role: 'admin' },
    { role: 'member' },
  );

  for (const member of workspaceSeed.members) {
    const role = normalizeWorkspaceRole(member.role);
    const existingMember = await memberRepo.findOne({
      where: {
        workspace_id: workspaceSeed.workspaceId,
        user_id: member.userId,
      },
    });

    if (existingMember) {
      existingMember.role = role;
      await memberRepo.save(existingMember);
      continue;
    }

    await memberRepo.save(
      memberRepo.create({
        workspace_id: workspaceSeed.workspaceId,
        user_id: member.userId,
        role,
      }),
    );
  }

  for (const projectSeed of workspaceSeed.projects) {
    let project = await projectRepo.findOne({
      where: { id: projectSeed.projectId },
    });

    if (!project) {
      project = projectRepo.create({
        id: projectSeed.projectId,
        workspace_id: workspaceSeed.workspaceId,
        name: projectSeed.projectName,
        description: projectSeed.projectDescription,
        created_by: workspaceSeed.ownerUserId,
        is_deleted: false,
      });
    } else {
      project.name = projectSeed.projectName;
      project.description = projectSeed.projectDescription;
      project.workspace_id = workspaceSeed.workspaceId;
      project.created_by = workspaceSeed.ownerUserId;
      project.is_deleted = false;
    }

    await projectRepo.save(project);
  }

  if (workspaceSeed.pendingInvitations?.length) {
    await seedPendingInvitations(
      workspaceSeed.workspaceId,
      workspaceSeed.pendingInvitations,
      invitationRepo,
    );
  }

  return {
    workspaceId: workspaceSeed.workspaceId,
    workspaceName: workspaceSeed.workspaceName,
    projectCount: workspaceSeed.projects.length,
    memberCount: workspaceSeed.members.length,
  };
}

async function main(): Promise<void> {
  loadEnvFile();

  const demoData = loadDemoSeedData();
  const workspaces = getDemoWorkspaces(demoData);
  const dataSource = new DataSource({
    type: 'postgres',
    url: requireDatabaseUrl(),
    schema: process.env.DATABASE_SCHEMA || 'public',
    entities: [WorkspaceOrmEntity, WorkspaceMemberOrmEntity, ProjectOrmEntity, InvitationOrmEntity],
    synchronize: toBoolean(process.env.DATABASE_SYNCHRONIZE, false),
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
  });

  await dataSource.initialize();

  try {
    const workspaceRepo = dataSource.getRepository(WorkspaceOrmEntity);
    const memberRepo = dataSource.getRepository(WorkspaceMemberOrmEntity);
    const projectRepo = dataSource.getRepository(ProjectOrmEntity);
    const invitationRepo = dataSource.getRepository(InvitationOrmEntity);

    const summary: Array<{
      workspaceId: string;
      workspaceName: string;
      projectCount: number;
      memberCount: number;
    }> = [];

    for (const workspaceSeed of workspaces) {
      summary.push(
        await seedWorkspaceBundle(
          workspaceSeed,
          workspaceRepo,
          memberRepo,
          projectRepo,
          invitationRepo,
        ),
      );
    }

    console.log('workspace-service seed completed');
    console.log(
      `Seeded ${summary.length} workspaces (Postgres collabspace_workspace — no cross-service replicas)`,
    );
    console.table(summary);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('workspace-service seed failed');
  console.error(error);
  process.exitCode = 1;
});
