import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { loadDemoSeedData } from "../../../scripts/load-demo-seed-data";

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
    throw new Error("MONGO_URI is required to run notification-service seed");
  }

  return mongoUri;
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

    const notifications = db.collection("notifications");
    const userReplicas = db.collection("user_replicas");
    const now = new Date("2026-01-15T09:05:00.000Z");

    for (const user of demoData.users) {
      await userReplicas.updateOne(
        { userId: user.id },
        {
          $set: {
            userId: user.id,
            email: user.email,
            username: user.username.toLowerCase(),
            fullName: user.fullName,
            displayName: user.fullName,
            avatarUrl: null,
            isActive: true,
          },
        },
        { upsert: true },
      );
    }

    for (const sample of demoData.demo.sampleNotifications) {
      await notifications.updateOne(
        {
          recipientId: sample.recipientId,
          type: sample.type,
          targetId: sample.targetId,
        },
        {
          $set: {
            recipientId: sample.recipientId,
            actorId: sample.actorId,
            type: sample.type,
            title: sample.title,
            message: sample.message,
            targetId: sample.targetId,
            targetType: sample.targetType,
            status: "UNREAD",
            metadata: { seeded: true },
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    console.log("notification-service seed completed");
    console.table(
      demoData.demo.sampleNotifications.map((notification) => ({
        recipientId: notification.recipientId,
        type: notification.type,
        targetId: notification.targetId,
      })),
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("notification-service seed failed");
  console.error(error);
  process.exitCode = 1;
});
