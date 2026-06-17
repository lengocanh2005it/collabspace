import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'demo-seed-data.json');
const data = JSON.parse(readFileSync(root, 'utf8'));
const users = new Map(data.users.map((u) => [u.id, u.fullName]));

function esc(value) {
  return String(value).replace(/'/g, "''");
}

const rows = [];

for (const ws of data.workspaces) {
  let step = 0;
  const base = new Date('2026-01-10T08:00:00.000Z');
  const at = () => {
    const d = new Date(base);
    d.setHours(d.getHours() + step);
    step += 1;
    return d.toISOString();
  };
  const owner = users.get(ws.ownerUserId) ?? 'Owner';

  rows.push({
    ws: ws.workspaceId,
    actor: ws.ownerUserId,
    name: owner,
    type: 'workspace_created',
    summary: `Workspace "${ws.workspaceName}" was created`,
    meta: JSON.stringify({ workspaceName: ws.workspaceName }),
    at: at(),
  });

  for (const project of ws.projects) {
    rows.push({
      ws: ws.workspaceId,
      actor: ws.ownerUserId,
      name: owner,
      type: 'project_created',
      summary: `Project "${project.projectName}" was created`,
      meta: JSON.stringify({
        projectId: project.projectId,
        projectName: project.projectName,
      }),
      at: at(),
    });
  }

  for (const member of ws.members) {
    if (member.userId === ws.ownerUserId) {
      continue;
    }

    rows.push({
      ws: ws.workspaceId,
      actor: member.userId,
      name: users.get(member.userId) ?? 'Member',
      type: 'member_joined',
      summary: 'A new member joined the workspace',
      meta: JSON.stringify({ userId: member.userId, role: member.role }),
      at: at(),
    });

    if (member.role === 'manager') {
      rows.push({
        ws: ws.workspaceId,
        actor: ws.ownerUserId,
        name: owner,
        type: 'member_role_changed',
        summary: 'Member role changed to manager',
        meta: JSON.stringify({ targetUserId: member.userId, role: 'manager' }),
        at: at(),
      });
    }
  }

  for (const invitation of ws.pendingInvitations ?? []) {
    rows.push({
      ws: ws.workspaceId,
      actor: invitation.inviterUserId,
      name: users.get(invitation.inviterUserId) ?? 'Member',
      type: 'member_invited',
      summary: `${invitation.email.toLowerCase()} was invited to the workspace`,
      meta: JSON.stringify({
        inviteeEmail: invitation.email.toLowerCase(),
        invitationId: invitation.id,
      }),
      at: at(),
    });
  }
}

const lines = ['DELETE FROM workspace_activities;'];

for (const row of rows) {
  lines.push(
    `INSERT INTO workspace_activities (workspace_id, actor_id, actor_name, type, summary, meta, occurred_at) VALUES ('${row.ws}', ${row.actor ? `'${row.actor}'` : 'NULL'}, '${esc(row.name)}', '${row.type}', '${esc(row.summary)}', '${esc(row.meta)}'::jsonb, '${row.at}');`,
  );
}

lines.push('SELECT workspace_id, count(*) AS activity_count FROM workspace_activities GROUP BY workspace_id ORDER BY workspace_id;');

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp-seed-workspace-activities.sql');
writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${rows.length} activity rows to ${out}`);
