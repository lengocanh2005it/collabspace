import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import {
  avatarUrlFor,
  loadDemoSeedData,
  userSnapshot,
  type DemoSeedTask,
  type DemoSeedUser,
} from "../../../scripts/load-demo-seed-data";

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
      {
        $set: {
          userId: user.id,
          email: user.email,
          username: user.username.toLowerCase(),
          fullName: user.fullName,
          displayName: user.fullName,
          avatarUrl: avatarUrlFor(user),
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
}

async function seedTask(
  taskSeed: DemoSeedTask,
  users: DemoSeedUser[],
  demo: ReturnType<typeof loadDemoSeedData>["demo"],
  taskEvents: mongoose.mongo.Collection,
  tasks: mongoose.mongo.Collection,
): Promise<void> {
  const createdByUser = findUser(users, taskSeed.createdByUserId);
  const createdBy = userSnapshot(createdByUser);
  const createdAt = new Date("2026-01-15T08:00:00.000Z");
  const assigneeUser = taskSeed.assigneeUserId
    ? findUser(users, taskSeed.assigneeUserId)
    : null;
  const assignedTo = assigneeUser ? userSnapshot(assigneeUser) : null;

  const createdPayload = {
    title: taskSeed.title,
    description: taskSeed.description,
    status: taskSeed.status,
    workspaceId: demo.workspaceId,
    projectId: demo.projectId,
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
        workspaceId: demo.workspaceId,
        projectId: demo.projectId,
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

async function seedSampleComment(
  demo: ReturnType<typeof loadDemoSeedData>["demo"],
  users: DemoSeedUser[],
  comments: mongoose.mongo.Collection,
): Promise<void> {
  const author = findUser(users, demo.sampleComment.authorUserId);

  await comments.updateOne(
    {
      taskId: demo.sampleComment.taskId,
      authorId: author.id,
      content: demo.sampleComment.content,
    },
    {
      $set: {
        taskId: demo.sampleComment.taskId,
        authorId: author.id,
        authorName: author.fullName,
        authorAvatarUrl: avatarUrlFor(author),
        content: demo.sampleComment.content,
        parentId: null,
        mentions: demo.sampleComment.mentionUserIds,
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

    await seedUserReplicas(demoData.users, userReplicas);

    for (const taskSeed of demoData.demo.tasks) {
      await seedTask(
        taskSeed,
        demoData.users,
        demoData.demo,
        taskEvents,
        tasks,
      );
    }

    await seedSampleComment(demoData.demo, demoData.users, comments);

    console.log("task-service seed completed");
    console.table(
      demoData.demo.tasks.map((task) => ({
        taskId: task.id,
        title: task.title,
        status: task.status,
        assigneeUserId: task.assigneeUserId ?? "(none)",
      })),
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("task-service seed failed");
  console.error(error);
  process.exitCode = 1;
});
