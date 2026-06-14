import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ProcessedEventDocument = HydratedDocument<ProcessedEvent>;

@Schema({ collection: "processed_events" })
export class ProcessedEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ required: true })
  processedAt!: Date;
}

export const ProcessedEventSchema =
  SchemaFactory.createForClass(ProcessedEvent);

ProcessedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });
