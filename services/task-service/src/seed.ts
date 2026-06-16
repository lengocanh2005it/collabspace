import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  avatarUrlFor,
  getDemoWorkspaces,
  loadDemoSeedData,
  userReplicaDocumentFor,
  userSnapshot,
  type DemoSeedComment,
  type DemoSeedTask,
  type DemoSeedUser,
} from "./load-demo-seed";
import { TaskActivityItemMapper } from "./application/mappers/task-activity-item.mapper";
import type { StoredTaskDomainEvent } from "./domain/events/task-domain.events";

function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

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

function requireMongoUri(): string {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required to run task-service seed");
  }

  return mongoUri;
}

function findUser(users: DemoSeedUser[], userId: string): DemoSeedUser {
  const user = users.find((entry) => entry.id === userId);

  if (!user) {
    throw new Error(`Missing demo user ${userId} in demo-seed-data.json`);
  }

  return user;
}

async function seedUserReplicas(
  users: DemoSeedUser[],
  collection: mongoose.mongo.Collection,
): Promise<void> {
  for (const user of users) {
    await collection.updateOne(
      { userId: user.id },
      { $set: userReplicaDocumentFor(user) },
      { upsert: true },
    );
  }
  console.log(`Seeded ${users.length} user_replicas (task-service)`);
}

async function seedTask(
  taskSeed: DemoSeedTask,
  users: DemoSeedUser[],
  workspaceId: string,
  projectId: string,
  taskEvents: mongoose.mongo.Collection,
  tasks: mongoose.mongo.Collection,
): Promise<void> {
  const createdByUser = findUser(users, taskSeed.createdByUserId);
  const createdBy = userSnapshot(createdByUser);
  const createdAt = new Date("2026-01-15T08:00:00.000Z");
  const assigneeUser = taskSeed.assigneeUserId ? findUser(users, taskSeed.assigneeUserId) : null;
  const assignedTo = assigneeUser ? userSnapshot(assigneeUser) : null;

  const createdPayload = {
    title: taskSeed.title,
    description: taskSeed.description,
    status: taskSeed.status,
    workspaceId,
    projectId,
    priority: taskSeed.priority,
    dueDate: null,
    labels: taskSeed.labels,
    createdBy,
    createdAt: createdAt.toISOString(),
  };

  await taskEvents.updateOne(
    { streamId: taskSeed.id, version: 1 },
    {
      $set: {
        streamId: taskSeed.id,
        version: 1,
        eventId: `${taskSeed.id}-created`,
        eventType: "TaskCreated",
        occurredAt: createdAt,
        payload: createdPayload,
      },
    },
    { upsert: true },
  );

  if (taskSeed.assigneeUserId && assignedTo) {
    await taskEvents.updateOne(
      { streamId: taskSeed.id, version: 2 },
      {
        $set: {
          streamId: taskSeed.id,
          version: 2,
          eventId: `${taskSeed.id}-assigned`,
          eventType: "TaskAssigneeChanged",
          occurredAt: new Date("2026-01-15T08:05:00.000Z"),
          payload: {
            assigneeId: taskSeed.assigneeUserId,
            assignedTo,
          },
        },
      },
      { upsert: true },
    );
  }

  await tasks.updateOne(
    { _id: taskSeed.id as unknown as mongoose.Types.ObjectId },
    {
      $set: {
        _id: taskSeed.id,
        title: taskSeed.title,
        description: taskSeed.description,
        status: taskSeed.status,
        workspaceId,
        projectId,
        priority: taskSeed.priority,
        dueDate: null,
        labels: taskSeed.labels,
        assigneeId: taskSeed.assigneeUserId,
        createdBy,
        assignedTo,
        attachments: [],
        createdAt,
        updatedAt: createdAt,
      },
    },
    { upsert: true },
  );
}

async function seedComment(
  commentSeed: DemoSeedComment,
  users: DemoSeedUser[],
  comments: mongoose.mongo.Collection,
): Promise<void> {
  const author = findUser(users, commentSeed.authorUserId);

  await comments.updateOne(
    {
      taskId: commentSeed.taskId,
      authorId: author.id,
      content: commentSeed.content,
    },
    {
      $set: {
        taskId: commentSeed.taskId,
        authorId: author.id,
        authorName: author.fullName,
        authorAvatarUrl: avatarUrlFor(author),
        content: commentSeed.content,
        parentId: null,
        mentions: commentSeed.mentionUserIds,
        isEdited: false,
        deletedAt: null,
        reactionCount: 0,
        createdAt: new Date("2026-01-15T09:00:00.000Z"),
        updatedAt: new Date("2026-01-15T09:00:00.000Z"),
      },
    },
    { upsert: true },
  );
}

async function backfillTaskActivity(
  taskEvents: mongoose.mongo.Collection,
  comments: mongoose.mongo.Collection,
  taskActivity: mongoose.mongo.Collection,
): Promise<void> {
  const writes: mongoose.mongo.AnyBulkWriteOperation<mongoose.mongo.BSON.Document>[] = [];

  const eventDocs = await taskEvents.find({}).toArray();
  for (const doc of eventDocs) {
    const storedEvent: StoredTaskDomainEvent = {
      streamId: String(doc.streamId),
      version: Number(doc.version),
      eventId: String(doc.eventId),
      eventType: doc.eventType as StoredTaskDomainEvent["eventType"],
      occurredAt:
        doc.occurredAt instanceof Date ? doc.occurredAt.toISOString() : String(doc.occurredAt),
      payload: doc.payload as StoredTaskDomainEvent["payload"],
    };
    const item = TaskActivityItemMapper.fromStoredEvent(storedEvent);
    if (!item) {
      continue;
    }

    writes.push({
      updateOne: {
        filter: { _id: item.id },
        update: {
          $set: {
            taskId: storedEvent.streamId,
            type: item.type,
            actorId: item.actorId,
            actorName: item.actorName,
            actorAvatarUrl: item.actorAvatarUrl,
            summary: item.summary,
            meta: item.meta,
            occurredAt: new Date(item.occurredAt),
          },
        },
        upsert: true,
      },
    } as unknown as mongoose.mongo.AnyBulkWriteOperation<mongoose.mongo.BSON.Document>);
  }

  const commentDocs = await comments.find({ deletedAt: null }).toArray();
  for (const doc of commentDocs) {
    const content = String(doc.content ?? "");
    writes.push({
      updateOne: {
        filter: { _id: doc._id.toString() },
        update: {
          $set: {
            taskId: String(doc.taskId),
            type: "comment_added",
            actorId: String(doc.authorId),
            actorName: String(doc.authorName),
            actorAvatarUrl: doc.authorAvatarUrl ?? null,
            summary: content.length > 120 ? `${content.slice(0, 120)}…` : content,
            meta: { commentId: doc._id.toString() },
            occurredAt:
              doc.createdAt instanceof Date ? doc.createdAt : new Date(String(doc.createdAt)),
          },
        },
        upsert: true,
      },
    } as unknown as mongoose.mongo.AnyBulkWriteOperation<mongoose.mongo.BSON.Document>);
  }

  if (writes.length > 0) {
    await taskActivity.bulkWrite(writes, { ordered: false });
  }
}

async function main(): Promise<void> {
  loadEnvFile();

  const demoData = loadDemoSeedData();
  await mongoose.connect(requireMongoUri());

  try {
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection is not ready");
    }

    const userReplicas = db.collection("user_replicas");
    const taskEvents = db.collection("task_events");
    const tasks = db.collection("tasks");
    const comments = db.collection("task_comments");
    const taskActivity = db.collection("task_activity");

    await seedUserReplicas(demoData.users, userReplicas);

    const taskSummary: Array<{
      taskId: string;
      title: string;
      status: string;
      workspaceId: string;
    }> = [];

    for (const workspace of getDemoWorkspaces(demoData)) {
      for (const project of workspace.projects) {
        for (const taskSeed of project.tasks) {
          await seedTask(
            taskSeed,
            demoData.users,
            workspace.workspaceId,
            project.projectId,
            taskEvents,
            tasks,
          );
          taskSummary.push({
            taskId: taskSeed.id,
            title: taskSeed.title,
            status: taskSeed.status,
            workspaceId: workspace.workspaceId,
          });
        }

        for (const commentSeed of project.sampleComments ?? []) {
          await seedComment(commentSeed, demoData.users, comments);
        }
      }
    }

    await backfillTaskActivity(taskEvents, comments, taskActivity);

    console.log("task-service seed completed");
    console.table(taskSummary);
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("task-service seed failed");
  console.error(error);
  process.exitCode = 1;
});
