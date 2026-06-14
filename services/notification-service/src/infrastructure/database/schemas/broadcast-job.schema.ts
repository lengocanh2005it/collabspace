import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type BroadcastJobDocument = HydratedDocument<BroadcastJob>;

@Schema({ collection: "notification_broadcast_jobs", timestamps: true })
export class BroadcastJob {
  @Prop({ required: true })
  actorId!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ default: 0 })
  cursor!: number;

  @Prop({ default: null, index: true, type: Date })
  claimedUntil!: Date | null;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey!: string;

  @Prop({ default: "pending", index: true })
  status!: "pending" | "processing" | "completed" | "failed";

  @Prop({ required: true })
  title!: string;
}

export const BroadcastJobSchema = SchemaFactory.createForClass(BroadcastJob);
BroadcastJobSchema.index({ status: 1, claimedUntil: 1, createdAt: 1 });
