import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireMongoUri(): string {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required to run dlq-service seed');
  return uri;
}

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const DLQ_RECORDS = [
  // 1. Transient error — pending, sẽ auto-retry
  {
    sourceTopic: 'collabspace.notification.events',
    sourcePartition: 0,
    sourceOffset: '1042',
    sourceKey: 'workspace_member_invited',
    consumerGroup: 'notification-service-consumer',
    payload: {
      eventId: 'evt-001',
      eventType: 'workspace_member_invited',
      workspaceId: 'ws-abc123',
      inviteeEmail: 'member@example.com',
      inviterId: 'user-xyz',
      occurredAt: hoursAgo(2).toISOString(),
    },
    errorMessage: 'MongoNetworkError: connection timed out after 5000ms',
    errorCategory: 'transient',
    failedAt: hoursAgo(2),
    status: 'pending',
    retryCount: 1,
    maxRetries: 3,
    nextRetryAt: minutesAgo(-10), // sắp được retry
    lastRetriedAt: hoursAgo(1),
    retryHistory: [
      {
        at: hoursAgo(1),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'MongoNetworkError: connection timed out after 5000ms',
      },
    ],
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },

  // 2. Logic error — requires_manual_review (task_assigned nhưng task không tồn tại)
  {
    sourceTopic: 'collabspace.task.events',
    sourcePartition: 0,
    sourceOffset: '2087',
    sourceKey: 'task_assigned',
    consumerGroup: 'notification-service-consumer',
    payload: {
      eventId: 'evt-002',
      eventType: 'task_assigned',
      taskId: 'task-deleted-99',
      assigneeId: 'user-abc',
      assignedBy: 'user-xyz',
      workspaceId: 'ws-abc123',
      occurredAt: hoursAgo(5).toISOString(),
    },
    errorMessage:
      "NotificationBuildError: task 'task-deleted-99' not found — cannot build notification",
    errorCategory: 'logic',
    failedAt: hoursAgo(4),
    status: 'requires_manual_review',
    retryCount: 3,
    maxRetries: 3,
    nextRetryAt: null,
    lastRetriedAt: hoursAgo(4),
    retryHistory: [
      {
        at: hoursAgo(5),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "task 'task-deleted-99' not found",
      },
      {
        at: hoursAgo(4.5),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "task 'task-deleted-99' not found",
      },
      {
        at: hoursAgo(4),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "task 'task-deleted-99' not found",
      },
    ],
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },

  // 3. Schema error — requires_manual_review (payload thiếu field bắt buộc)
  {
    sourceTopic: 'collabspace.workspace.events',
    sourcePartition: 0,
    sourceOffset: '558',
    sourceKey: 'workspace_member_removed',
    consumerGroup: 'task-service-consumer',
    payload: {
      eventId: 'evt-003',
      eventType: 'workspace_member_removed',
      // thiếu workspaceId và userId — schema không hợp lệ
      occurredAt: hoursAgo(3).toISOString(),
    },
    errorMessage: "ValidationError: 'workspaceId' is required, 'userId' is required",
    errorCategory: 'schema',
    failedAt: hoursAgo(3),
    status: 'requires_manual_review',
    retryCount: 3,
    maxRetries: 3,
    nextRetryAt: null,
    lastRetriedAt: hoursAgo(3),
    retryHistory: [
      {
        at: hoursAgo(3.5),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "'workspaceId' is required",
      },
      {
        at: hoursAgo(3.2),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "'workspaceId' is required",
      },
      {
        at: hoursAgo(3),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: "'workspaceId' is required",
      },
    ],
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },

  // 4. Transient error — đã resolved sau khi admin replay thành công
  {
    sourceTopic: 'collabspace.task.events',
    sourcePartition: 0,
    sourceOffset: '1901',
    sourceKey: 'comment_created',
    consumerGroup: 'notification-service-consumer',
    payload: {
      eventId: 'evt-004',
      eventType: 'comment_created',
      taskId: 'task-001',
      commentId: 'cmt-555',
      authorId: 'user-abc',
      mentionedUserIds: ['user-xyz'],
      occurredAt: hoursAgo(6).toISOString(),
    },
    errorMessage: 'ServiceUnavailableException: user-service gRPC UNAVAILABLE',
    errorCategory: 'transient',
    failedAt: hoursAgo(6),
    status: 'resolved',
    retryCount: 2,
    maxRetries: 3,
    nextRetryAt: null,
    lastRetriedAt: hoursAgo(5),
    retryHistory: [
      {
        at: hoursAgo(6),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'gRPC UNAVAILABLE',
      },
      {
        at: hoursAgo(5.5),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'gRPC UNAVAILABLE',
      },
      { at: hoursAgo(5), by: 'manual_replay', action: 'manual_replay', result: 'success' },
    ],
    replayedBy: 'admin@collabspace.dev',
    resolvedBy: 'admin@collabspace.dev',
    discardedBy: null,
    resolutionNote: 'user-service recovered, manual replay thành công',
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },

  // 5. Logic error — discarded (event cũ, không còn relevance)
  {
    sourceTopic: 'collabspace.workspace.events',
    sourcePartition: 0,
    sourceOffset: '312',
    sourceKey: 'workspace_deleted',
    consumerGroup: 'analytics-service-consumer',
    payload: {
      eventId: 'evt-005',
      eventType: 'workspace_deleted',
      workspaceId: 'ws-old-deleted',
      deletedBy: 'user-admin',
      occurredAt: hoursAgo(24).toISOString(),
    },
    errorMessage:
      "AnalyticsWriteError: workspace 'ws-old-deleted' snapshot not found — already cleaned up",
    errorCategory: 'logic',
    failedAt: hoursAgo(23),
    status: 'discarded',
    retryCount: 3,
    maxRetries: 3,
    nextRetryAt: null,
    lastRetriedAt: hoursAgo(22),
    retryHistory: [
      {
        at: hoursAgo(23.5),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'workspace snapshot not found',
      },
      {
        at: hoursAgo(23),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'workspace snapshot not found',
      },
      {
        at: hoursAgo(22),
        by: 'auto_retry',
        action: 'auto_retry',
        result: 'failure',
        errorMessage: 'workspace snapshot not found',
      },
    ],
    replayedBy: null,
    resolvedBy: null,
    discardedBy: 'admin@collabspace.dev',
    resolutionNote:
      'Workspace đã bị xóa hoàn toàn, analytics snapshot không còn tồn tại — safe to discard',
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },

  // 6. Unknown error — pending, chưa retry lần nào
  {
    sourceTopic: 'collabspace.user.events',
    sourcePartition: 0,
    sourceOffset: '4401',
    sourceKey: 'user_profile_updated',
    consumerGroup: 'task-service-consumer',
    payload: {
      eventId: 'evt-006',
      eventType: 'user_profile_updated',
      userId: 'user-def',
      displayName: 'Ngọc Anh',
      avatarUrl: null,
      occurredAt: minutesAgo(15).toISOString(),
    },
    errorMessage:
      'UnhandledPromiseRejection: Cannot read properties of undefined (reading "userId")',
    errorCategory: 'unknown',
    failedAt: minutesAgo(15),
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: minutesAgo(-5), // retry sau 5 phút
    lastRetriedAt: null,
    retryHistory: [],
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
  },
];

async function seed(): Promise<void> {
  loadEnvFile();
  const mongoUri = requireMongoUri();

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { dbName: 'collabspace_dlq' });

  const collection = mongoose.connection.collection('dlq_records');

  // Upsert theo unique index (sourceTopic, sourcePartition, sourceOffset)
  let inserted = 0;
  let skipped = 0;

  for (const record of DLQ_RECORDS) {
    const filter = {
      sourceTopic: record.sourceTopic,
      sourcePartition: record.sourcePartition,
      sourceOffset: record.sourceOffset,
    };

    const result = await collection.updateOne(
      filter,
      {
        $setOnInsert: {
          ...record,
          createdAt: record.failedAt,
          updatedAt: record.failedAt,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      inserted++;
      console.log(
        `  ✓ Inserted [${record.status}/${record.errorCategory}] ${record.sourceTopic}:${record.sourceOffset}`,
      );
    } else {
      skipped++;
      console.log(`  - Skipped (already exists) ${record.sourceTopic}:${record.sourceOffset}`);
    }
  }

  console.log(`\nDLQ seed done: ${inserted} inserted, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('DLQ seed failed:', err);
  process.exit(1);
});
