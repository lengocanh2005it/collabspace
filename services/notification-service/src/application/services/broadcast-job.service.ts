import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Notification } from "../../domain/entities/Notification";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../domain/repositories/INotificationRepository";
import { NotificationType } from "../../domain/value-objects/NotificationType";
import {
  USER_REPLICA_REPOSITORY_TOKEN,
  type IUserReplicaRepository,
} from "../ports/IUserReplicaRepository";
import {
  BroadcastJob,
  type BroadcastJobDocument,
} from "../../infrastructure/database/schemas/broadcast-job.schema";

@Injectable()
export class BroadcastJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastJobService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(BroadcastJob.name)
    private readonly jobModel: Model<BroadcastJobDocument>,
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userRepository: IUserReplicaRepository,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.processNext(), 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(input: { actorId: string; body: string; idempotencyKey: string; title: string }) {
    try {
      const job = await this.jobModel.create({
        ...input,
        cursor: 0,
        status: "pending",
      });
      this.logger.log(`admin_action=broadcast_enqueued actorId=${input.actorId} jobId=${job.id}`);
      return { id: job.id, status: job.status };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException({
          code: "BROADCAST_ALREADY_ENQUEUED",
          message: "A broadcast with this Idempotency-Key already exists",
        });
      }
      throw error;
    }
  }

  async processNext(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.jobModel
        .findOneAndUpdate(
          {
            $or: [
              { status: "pending" },
              {
                status: "processing",
                claimedUntil: { $lte: new Date() },
              },
            ],
          },
          {
            $set: {
              claimedUntil: new Date(Date.now() + 5 * 60 * 1000),
              status: "processing",
            },
          },
          { returnDocument: "after", sort: { createdAt: 1 } },
        )
        .exec();
      if (!job) return;
      const batchSize = 100;
      const recipients = await this.userRepository.listActiveUserIdsAsync(job.cursor, batchSize);
      for (const recipientId of recipients) {
        await this.notificationRepository.createBroadcastAsync(
          Notification.create(
            recipientId,
            job.actorId,
            NotificationType.SYSTEM_BROADCAST,
            job.title,
            job.body,
            job.id,
            "SYSTEM_BROADCAST",
            { broadcastId: job.id },
          ),
          `${job.id}:${recipientId}`,
        );
      }
      job.cursor += recipients.length;
      job.status = recipients.length < batchSize ? "completed" : "processing";
      job.claimedUntil = null;
      await job.save();
    } catch (error) {
      this.logger.error(
        `Broadcast processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
