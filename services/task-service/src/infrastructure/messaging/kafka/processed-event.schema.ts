import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type ProcessedKafkaEventDocument = HydratedDocument<ProcessedKafkaEvent>;

@Schema({ collection: "processed_kafka_events" })
export class ProcessedKafkaEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ required: true })
  processedAt!: Date;
}

export const ProcessedKafkaEventSchema = SchemaFactory.createForClass(ProcessedKafkaEvent);

// TTL: 7 days
ProcessedKafkaEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });
