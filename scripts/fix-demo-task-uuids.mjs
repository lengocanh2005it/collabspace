/**
 * Fix invalid task UUIDs in demo-seed-data.json (last segment was 11 hex chars).
 * Run: node scripts/fix-demo-task-uuids.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'demo-seed-data.json');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fixUuid(id) {
  if (!id || typeof id !== 'string' || UUID_RE.test(id)) {
    return id;
  }

  const parts = id.split('-');
  if (parts.length !== 5) {
    return id;
  }

  const last = parts[4];
  if (last.length === 11 && /^[0-9a-f]{8}\d{3}$/i.test(last)) {
    const fixed = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${last.slice(0, 8)}0${last.slice(8)}`;
    if (UUID_RE.test(fixed)) {
      return fixed;
    }
  }

  const padded = last.padStart(12, '0').slice(-12);
  const fixed = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${padded}`;
  return UUID_RE.test(fixed) ? fixed : id;
}

const data = JSON.parse(readFileSync(root, 'utf8'));
const idMap = new Map();

function remapId(id) {
  if (!id || typeof id !== 'string') {
    return id;
  }
  if (idMap.has(id)) {
    return idMap.get(id);
  }
  const fixed = fixUuid(id);
  if (fixed !== id) {
    idMap.set(id, fixed);
  }
  return fixed;
}

for (const workspace of data.workspaces) {
  for (const project of workspace.projects ?? []) {
    for (const task of project.tasks ?? []) {
      task.id = remapId(task.id);
    }
    for (const comment of project.sampleComments ?? []) {
      comment.taskId = remapId(comment.taskId);
    }
  }
  for (const notification of workspace.sampleNotifications ?? []) {
    if (notification.targetType === 'TASK' && notification.targetId) {
      notification.targetId = remapId(notification.targetId);
    }
  }
}

const remaining = new Set();
for (const workspace of data.workspaces) {
  for (const project of workspace.projects ?? []) {
    for (const task of project.tasks ?? []) {
      if (!UUID_RE.test(task.id)) {
        remaining.add(task.id);
      }
    }
  }
}

writeFileSync(root, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Fixed ${idMap.size} task id(s)`);
if (remaining.size > 0) {
  console.error('Still invalid:', [...remaining]);
  process.exit(1);
}
console.log('All task UUIDs valid');
