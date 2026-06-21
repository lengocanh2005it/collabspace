import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type PlatformSnapshotDocument = HydratedDocument<PlatformSnapshot>;

@Schema({ collection: 'platform_snapshots' })
export class PlatformSnapshot {
  @Prop({
    type: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      banned: { type: Number, default: 0 },
      withoutWorkspace: { type: Number, default: 0 },
      activeLast30d: { type: Number, default: 0 },
    },
    default: () => ({ total: 0, active: 0, banned: 0, withoutWorkspace: 0, activeLast30d: 0 }),
  })
  users!: {
    total: number;
    active: number;
    banned: number;
    withoutWorkspace: number;
    activeLast30d: number;
  };

  @Prop({
    type: {
      total: { type: Number, default: 0 },
      totalMembers: { type: Number, default: 0 },
      avgMembersPerWorkspace: { type: Number, default: 0 },
    },
    default: () => ({ total: 0, totalMembers: 0, avgMembersPerWorkspace: 0 }),
  })
  workspaces!: {
    total: number;
    totalMembers: number;
    avgMembersPerWorkspace: number;
  };

  @Prop({
    type: { total: { type: Number, default: 0 } },
    default: () => ({ total: 0 }),
  })
  projects!: { total: number };

  @Prop({
    type: {
      total: { type: Number, default: 0 },
      byStatus: {
        TODO: { type: Number, default: 0 },
        DOING: { type: Number, default: 0 },
        DONE: { type: Number, default: 0 },
      },
    },
    default: () => ({ total: 0, byStatus: { TODO: 0, DOING: 0, DONE: 0 } }),
  })
  tasks!: { total: number; byStatus: { TODO: number; DOING: number; DONE: number } };

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const PlatformSnapshotSchema = SchemaFactory.createForClass(PlatformSnapshot);
