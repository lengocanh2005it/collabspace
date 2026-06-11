import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type IdempotencyKeyDocument = HydratedDocument<IdempotencyKeyRecord>;

@Schema({ collection: "idempotency_keys" })
export class IdempotencyKeyRecord {
  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String, index: true })
  idempotencyKey!: string;

  @Prop({ required: true, type: String })
  route!: string;

  @Prop({ required: true, type: Number })
  statusCode!: number;

  @Prop({ required: true, type: Object })
  responseBody!: Record<string, unknown>;

  @Prop({ required: true, type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;
}

export const IdempotencyKeySchema =
  SchemaFactory.createForClass(IdempotencyKeyRecord);

IdempotencyKeySchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true },
);
