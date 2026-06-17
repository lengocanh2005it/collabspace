/**
 * One-shot expander for demo-seed-data.json — run: node scripts/expand-demo-seed-data.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'demo-seed-data.json');
const data = JSON.parse(readFileSync(root, 'utf8'));

const U = {
  ngocanh: '22222222-2222-4222-8222-222222222222',
  quangtien: '33333333-3333-4333-8333-333333333333',
  reviewer: '55555555-5555-4555-8555-555555555555',
  qaAlice: '66666666-6666-4666-8666-666666666666',
  devBob: '77777777-7777-4777-8777-777777777777',
  pmCarol: '88888888-8888-4888-8888-888888888888',
  designerDana: '99999999-9999-4999-8999-999999999999',
  tho: '11111111-1111-4111-8111-111111111111',
  trungtin: '44444444-4444-4444-8444-444444444444',
  devAlex: '12111111-1111-4111-8111-121111111111',
  devFelix: '12222222-2222-4222-8222-122222222222',
  devGina: '12333333-3333-4333-8333-123333333333',
  qaAlvin: '12444444-4444-4444-8444-124444444444',
  pmHelen: '12555555-5555-4555-8555-125555555555',
  designerIan: '12666666-6666-4666-8666-126666666666',
  memberKhanh: '12777777-7777-4777-8777-127777777777',
  viewerMaria: '12888888-8888-4888-8888-128888888888',
  soloOwner: '61000000-0000-4000-8000-000000000001',
  devEve: '61000000-0000-4000-8000-000000000003',
};

const statuses = ['TODO', 'DOING', 'DONE'];
const priorities = ['LOW', 'MEDIUM', 'HIGH'];
const labelPool = ['frontend', 'backend', 'qa', 'docs', 'ux', 'infra', 'design', 'api', 'mobile', 'perf'];

function makeTaskId(prefixBase, n) {
  const head = prefixBase.replace(/-/g, '').slice(0, 8).padEnd(8, 'c');
  const seq4 = String(n).padStart(4, '0');
  const third = `4${((n % 9) + 1).toString(16)}cc`;
  const fourth = '8cc1';
  const tail = `${head}0${String(n).padStart(3, '0')}`;
  return `${head}-${seq4}-${third}-${fourth}-${tail}`;
}

function makeTasks(prefixBase, start, count, titles, creators, assignees) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const id = makeTaskId(prefixBase, n);
    tasks.push({
      id,
      title: titles[i % titles.length] + (count > titles.length ? ` (${i + 1})` : ''),
      description: `Demo seed task #${n} — fills kanban, dashboard, and directory UI.`,
      status: statuses[n % 3],
      priority: priorities[n % 3],
      labels: [labelPool[n % labelPool.length], labelPool[(n + 3) % labelPool.length]].slice(0, n % 2 === 0 ? 2 : 1),
      assigneeUserId: n % 4 === 0 ? null : assignees[n % assignees.length],
      createdByUserId: creators[n % creators.length],
    });
  }
  return tasks;
}

const demoTitles = [
  'Polish invitation accept flow',
  'Add workspace activity filters',
  'Fix member count in header',
  'E2E test invite duplicate email',
  'Sync OpenAPI response DTOs',
  'Improve error toast copy',
  'Board drag-and-drop QA',
  'Mention autocomplete edge cases',
  'Notification poll backoff',
  'Profile avatar crop UX',
  'Command palette recent items',
  'Kanban WIP limit indicator',
  'Task due date picker',
  'Workspace switcher keyboard nav',
  'Admin KPI from task totals',
  'Directory search debounce',
  'Comment thread collapse',
  'Mobile nav workspace list',
];

const productTitles = [
  'FE role badge for platform user',
  'Dashboard chart from getBoard',
  'Project card relative dates',
  'Task deep link share button',
  'Presence dot on member rows',
  'Bulk assign from board',
  'Label filter on task list',
  'Export board to CSV',
  'Workspace logo upload',
  'Manager promote confirmation',
];

const infraTitles = [
  'Helm rollout timeout tuning',
  'Loki retention policy',
  'Backup restore drill',
  'Traefik access log sampling',
  'Mongo index review',
  'Redis memory alert',
  'CI image scan gate',
  'Seed job idempotency test',
];

const assigneePool = Object.values(U).filter((id) => id !== U.devEve && id !== U.soloOwner);

function findWorkspace(name) {
  const ws = data.workspaces.find((w) => w.workspaceName === name);
  if (!ws) throw new Error(`workspace ${name} not found`);
  return ws;
}

// --- CollabSpace Demo ---
const demo = findWorkspace('CollabSpace Demo');
const mvp = demo.projects.find((p) => p.projectName === 'MVP Sprint');
const qa = demo.projects.find((p) => p.projectName === 'QA Hardening');

mvp.tasks.push(...makeTasks('cccccccc', 10, 12, demoTitles, [U.ngocanh, U.pmCarol], assigneePool));
qa.tasks.push(
  ...makeTasks('cccccccc', 30, 8, demoTitles.slice(8), [U.qaAlice, U.pmCarol], assigneePool),
);

demo.projects.push({
  projectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  projectName: 'Release Train',
  projectDescription: 'Sprint backlog — dense board for UI demos.',
  tasks: makeTasks('cccccccc', 50, 14, demoTitles, [U.ngocanh, U.quangtien], assigneePool),
  sampleComments: [
    {
      taskId: '',
      authorUserId: U.ngocanh,
      content: 'Please review @pm.carol — targeting Friday demo.',
      mentionUserIds: [U.pmCarol],
    },
  ],
});
// fix comment taskId to first task in new project
const releaseProject = demo.projects.at(-1);
releaseProject.sampleComments[0].taskId = releaseProject.tasks[0].id;

(mvp.sampleComments ??= []).push(
  {
    taskId: mvp.tasks[0].id,
    authorUserId: U.devAlex,
    content: 'Gateway headers look good in staging — @le.ngoc.anh please verify.',
    mentionUserIds: [U.ngocanh],
  },
  {
    taskId: mvp.tasks[1]?.id ?? mvp.tasks[0].id,
    authorUserId: U.memberKhanh,
    content: 'Added draft PR link in description.',
    mentionUserIds: [],
  },
);

// --- Product Lab ---
const lab = findWorkspace('Product Lab');
const feature = lab.projects.find((p) => p.projectName === 'Feature Backlog');
feature.tasks.push(
  ...makeTasks('dddddddd', 10, 10, productTitles, [U.quangtien, U.pmCarol], assigneePool),
);
lab.projects.push({
  projectId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  projectName: 'Mobile & Polish',
  projectDescription: 'Responsive and visual polish.',
  tasks: makeTasks('dddddddd', 40, 10, productTitles, [U.quangtien, U.designerDana], assigneePool),
});

// --- Infra Ops ---
const infra = findWorkspace('Infra Ops');
const runbook = infra.projects[0];
runbook.tasks.push(...makeTasks('eeeeeeee', 10, 6, infraTitles, [U.tho, U.trungtin], assigneePool));
infra.projects.push({
  projectId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  projectName: 'CI/CD Pipeline',
  projectDescription: 'Build, deploy, and smoke automation.',
  tasks: makeTasks('eeeeeeee', 30, 8, infraTitles, [U.tho, U.trungtin], assigneePool),
});

// --- Solo Sandbox ---
const solo = findWorkspace('Solo Sandbox');
solo.projects[0].tasks.push(
  ...makeTasks('ffffffff', 10, 4, ['Personal backlog item', 'Try labels', 'Check notifications', 'Sandbox task'], [U.soloOwner], [U.soloOwner]),
);

(qa.sampleComments ??= []).push({
  taskId: qa.tasks[0].id,
  authorUserId: U.qaAlice,
  content: 'Regression pack updated — @qa.alvin please rerun smoke.',
  mentionUserIds: [U.qaAlvin],
});

for (const project of demo.projects) {
  const first = project.tasks[0];
  if (!first) continue;
  (project.sampleComments ??= []).push({
    taskId: first.id,
    authorUserId: U.pmCarol,
    content: `Kickoff note on ${project.projectName} — sync in standup.`,
    mentionUserIds: [],
  });
}

for (const project of lab.projects) {
  const t = project.tasks[1] ?? project.tasks[0];
  if (!t) continue;
  (project.sampleComments ??= []).push({
    taskId: t.id,
    authorUserId: U.quangtien,
    content: '@dev.bob can you pair on this today?',
    mentionUserIds: [U.devBob],
  });
}

// --- Notifications (dense inbox for primary demo users) ---
function notif(recipientId, actorId, type, title, message, targetId, targetType, status = 'UNREAD') {
  return { recipientId, actorId, type, title, message, targetId, targetType, status };
}

const extraNotifs = [];
const demoTasks = demo.projects.flatMap((p) => p.tasks);
for (let i = 0; i < 12; i++) {
  const task = demoTasks[i % demoTasks.length];
  extraNotifs.push(
    notif(
      U.ngocanh,
      assigneePool[i % assigneePool.length],
      i % 3 === 0 ? 'COMMENT_MENTIONED' : 'TASK_ASSIGNED',
      i % 3 === 0 ? 'You were mentioned' : 'Task assigned to you',
      i % 3 === 0 ? `Mention on ${task.title}` : `Update: ${task.title}`,
      task.id,
      i % 3 === 0 ? 'COMMENT' : 'TASK',
      i % 4 === 0 ? 'READ' : i % 5 === 0 ? 'ARCHIVED' : 'UNREAD',
    ),
  );
}
for (let i = 0; i < 8; i++) {
  const task = lab.projects.flatMap((p) => p.tasks)[i];
  extraNotifs.push(
    notif(
      U.quangtien,
      U.devBob,
      'TASK_ASSIGNED',
      'Task assigned to you',
      `Product Lab: ${task?.title ?? 'task'}`,
      task?.id ?? lab.workspaceId,
      'TASK',
      i % 2 === 0 ? 'UNREAD' : 'READ',
    ),
  );
}
for (const [recipient, status] of [
  [U.qaAlice, 'UNREAD'],
  [U.pmCarol, 'READ'],
  [U.devBob, 'UNREAD'],
  [U.reviewer, 'READ'],
  [U.memberKhanh, 'UNREAD'],
]) {
  extraNotifs.push(
    notif(
      recipient,
      U.ngocanh,
      'WORKSPACE_INVITED',
      'Workspace update',
      'New tasks added to CollabSpace Demo',
      demo.workspaceId,
      'WORKSPACE',
      status,
    ),
  );
}

demo.sampleNotifications = [...(demo.sampleNotifications ?? []), ...extraNotifs.slice(0, 14)];
lab.sampleNotifications = [...(lab.sampleNotifications ?? []), ...extraNotifs.slice(14, 22)];
infra.sampleNotifications = [...(infra.sampleNotifications ?? []), ...extraNotifs.slice(22)];

// --- Meta ---
let taskCount = 0;
let projectCount = 0;
let commentCount = 0;
let notificationCount = 0;
for (const ws of data.workspaces) {
  projectCount += ws.projects.length;
  for (const p of ws.projects) {
    taskCount += p.tasks.length;
    commentCount += (p.sampleComments ?? []).length;
  }
  notificationCount += (ws.sampleNotifications ?? []).length;
}

data._meta = {
  ...data._meta,
  accountCount: data.users.length,
  workspaceCount: data.workspaces.length,
  projectCount,
  taskCount,
  commentCount,
  notificationCount,
  note: 'Dense demo data for UI — re-seed all services after pull.',
};

// Bio tweaks for renamed platform roles
const viewerOnly = data.users.find((u) => u.email === 'viewer.only@collabspace.dev');
if (viewerOnly) {
  viewerOnly.bio = 'Platform user — no workspace yet (empty state / onboarding UI).';
  viewerOnly.fullName = 'New User Nina';
}
const viewerMaria = data.users.find((u) => u.email === 'viewer.maria@collabspace.dev');
if (viewerMaria) {
  viewerMaria.bio = 'Platform user — member in Infra Ops for directory/board density.';
  viewerMaria.fullName = 'Maria Santos';
}

writeFileSync(root, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Expanded demo seed:', data._meta);
