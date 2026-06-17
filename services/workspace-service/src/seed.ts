import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWorkspaceRole } from '@collabspace/shared';
import { DataSource, type Repository } from 'typeorm';
import { WorkspaceOrmEntity } from './infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from './infrastructure/database/entities/workspace-member.orm-entity';
import { ProjectOrmEntity } from './infrastructure/database/entities/project.orm-entity';
import { InvitationOrmEntity } from './infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceActivityOrmEntity } from './infrastructure/database/entities/workspace-activity.orm-entity';
import type { WorkspaceActivityType } from './domain/entities/workspace-activity.entity';
import {
  getDemoWorkspaces,
  loadDemoSeedData,
  type DemoSeedPendingInvitation,
  type DemoSeedUser,
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

function findUser(users: DemoSeedUser[], userId: string): DemoSeedUser | undefined {
  return users.find((user) => user.id === userId);
}

function actorNameFor(users: DemoSeedUser[], userId: string | null | undefined): string | null {
  if (!userId) {
    return null;
  }

  return findUser(users, userId)?.fullName ?? null;
}

type ActivitySeedRow = {
  workspaceId: string;
  actorId: string | null;
  actorName: string | null;
  type: WorkspaceActivityType;
  summary: string;
  meta: Record<string, unknown>;
  occurredAt: Date;
};

function buildWorkspaceActivityRows(
  workspaceSeed: DemoSeedWorkspace,
  users: DemoSeedUser[],
): ActivitySeedRow[] {
  const rows: ActivitySeedRow[] = [];
  const baseTime = new Date('2026-01-10T08:00:00.000Z');
  let step = 0;

  const nextOccurredAt = (): Date => {
    const occurredAt = new Date(baseTime);
    occurredAt.setHours(occurredAt.getHours() + step);
    step += 1;
    return occurredAt;
  };

  const ownerName = actorNameFor(users, workspaceSeed.ownerUserId);

  rows.push({
    workspaceId: workspaceSeed.workspaceId,
    actorId: workspaceSeed.ownerUserId,
    actorName: ownerName,
    type: 'workspace_created',
    summary: `Workspace "${workspaceSeed.workspaceName}" was created`,
    meta: { workspaceName: workspaceSeed.workspaceName },
    occurredAt: nextOccurredAt(),
  });

  for (const project of workspaceSeed.projects) {
    rows.push({
      workspaceId: workspaceSeed.workspaceId,
      actorId: workspaceSeed.ownerUserId,
      actorName: ownerName,
      type: 'project_created',
      summary: `Project "${project.projectName}" was created`,
      meta: { projectId: project.projectId, projectName: project.projectName },
      occurredAt: nextOccurredAt(),
    });
  }

  for (const member of workspaceSeed.members) {
    if (member.userId === workspaceSeed.ownerUserId) {
      continue;
    }

    rows.push({
      workspaceId: workspaceSeed.workspaceId,
      actorId: member.userId,
      actorName: actorNameFor(users, member.userId),
      type: 'member_joined',
      summary: 'A new member joined the workspace',
      meta: { userId: member.userId, role: member.role },
      occurredAt: nextOccurredAt(),
    });

    if (member.role === 'manager') {
      rows.push({
        workspaceId: workspaceSeed.workspaceId,
        actorId: workspaceSeed.ownerUserId,
        actorName: ownerName,
        type: 'member_role_changed',
        summary: 'Member role changed to manager',
        meta: { targetUserId: member.userId, role: 'manager' },
        occurredAt: nextOccurredAt(),
      });
    }
  }

  for (const invitation of workspaceSeed.pendingInvitations ?? []) {
    rows.push({
      workspaceId: workspaceSeed.workspaceId,
      actorId: invitation.inviterUserId,
      actorName: actorNameFor(users, invitation.inviterUserId),
      type: 'member_invited',
      summary: `${invitation.email.toLowerCase()} was invited to the workspace`,
      meta: { inviteeEmail: invitation.email.toLowerCase(), invitationId: invitation.id },
      occurredAt: nextOccurredAt(),
    });
  }

  return rows;
}

async function seedWorkspaceActivities(
  workspaceSeed: DemoSeedWorkspace,
  users: DemoSeedUser[],
  activityRepo: Repository<WorkspaceActivityOrmEntity>,
): Promise<number> {
  await activityRepo.delete({ workspace_id: workspaceSeed.workspaceId });

  const rows = buildWorkspaceActivityRows(workspaceSeed, users);
  if (rows.length === 0) {
    return 0;
  }

  for (const row of rows) {
    const entity = activityRepo.create({
      workspace_id: row.workspaceId,
      actor_id: row.actorId,
      actor_name: row.actorName,
      type: row.type,
      summary: row.summary,
      meta: row.meta,
    });
    entity.occurred_at = row.occurredAt;
    await activityRepo.save(entity);
  }

  return rows.length;
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
  activityRepo: Repository<WorkspaceActivityOrmEntity>,
  users: DemoSeedUser[],
): Promise<{
  workspaceId: string;
  workspaceName: string;
  projectCount: number;
  memberCount: number;
  activityCount: number;
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

  const activityCount = await seedWorkspaceActivities(workspaceSeed, users, activityRepo);

  return {
    workspaceId: workspaceSeed.workspaceId,
    workspaceName: workspaceSeed.workspaceName,
    projectCount: workspaceSeed.projects.length,
    memberCount: workspaceSeed.members.length,
    activityCount,
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
    entities: [
      WorkspaceOrmEntity,
      WorkspaceMemberOrmEntity,
      ProjectOrmEntity,
      InvitationOrmEntity,
      WorkspaceActivityOrmEntity,
    ],
    synchronize: toBoolean(process.env.DATABASE_SYNCHRONIZE, false),
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
  });

  await dataSource.initialize();

  try {
    const workspaceRepo = dataSource.getRepository(WorkspaceOrmEntity);
    const memberRepo = dataSource.getRepository(WorkspaceMemberOrmEntity);
    const projectRepo = dataSource.getRepository(ProjectOrmEntity);
    const invitationRepo = dataSource.getRepository(InvitationOrmEntity);
    const activityRepo = dataSource.getRepository(WorkspaceActivityOrmEntity);

    const summary: Array<{
      workspaceId: string;
      workspaceName: string;
      projectCount: number;
      memberCount: number;
      activityCount: number;
    }> = [];

    for (const workspaceSeed of workspaces) {
      summary.push(
        await seedWorkspaceBundle(
          workspaceSeed,
          workspaceRepo,
          memberRepo,
          projectRepo,
          invitationRepo,
          activityRepo,
          demoData.users,
        ),
      );
    }

    const totalActivities = summary.reduce((sum, row) => sum + row.activityCount, 0);

    console.log('workspace-service seed completed');
    console.log(
      `Seeded ${summary.length} workspaces + ${totalActivities} activity rows (Postgres collabspace_workspace)`,
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
