// src/infrastructure/persistence/user-replica.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'user_replicas', // Tên bảng trong MongoDB 
  timestamps: true 
})
export class UserReplica extends Document {
  @Prop({ required: true, unique: true, index: true })
  userId: string; // Lưu ý: Đây là ID gốc bắn sang từ Identity Service

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'https://default-avatar.com/avatar.png' })
  avatarUrl: string;

  @Prop({ default: true })
  isActive: boolean; // Cực kỳ quan trọng: Lỡ bên Identity nó khóa mõm user này thì bên Task phải biết để không cho assign task nữa
}

export const UserReplicaSchema = SchemaFactory.createForClass(UserReplica);