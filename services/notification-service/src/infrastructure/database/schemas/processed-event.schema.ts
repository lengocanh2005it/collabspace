import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type ProcessedEventDocument = HydratedDocument<ProcessedEvent>;

@Schema({ collection: "processed_events" })
export class ProcessedEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ default: null, index: true, type: Date })
  claimedUntil!: Date | null;

  @Prop({ default: null, type: Date })
  processedAt!: Date | null;
}

export const ProcessedEventSchema = SchemaFactory.createForClass(ProcessedEvent);

ProcessedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });
