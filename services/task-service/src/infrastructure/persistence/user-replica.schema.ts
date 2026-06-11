// src/infrastructure/persistence/user-replica.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ collection: "user_replicas" })
export class UserReplica {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, default: null, index: true })
  username?: string | null;

  @Prop({ type: String, required: true })
  fullName!: string;

  @Prop({ type: String, default: null })
  displayName?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: String, default: null })
  avatarUrl?: string | null;
}

export const UserReplicaSchema = SchemaFactory.createForClass(UserReplica);
