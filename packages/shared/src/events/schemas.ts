import { z } from 'zod';

// ── Envelope ──────────────────────────────────────────────────────────────────

export const EventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.string().min(1),
});

// ── Workspace events ──────────────────────────────────────────────────────────

export const WorkspaceInvitedEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  invitedById: z.string().min(1),
  workspaceName: z.string().optional(),
  invitationId: z.string().optional(),
  recipientId: z.string().optional(),
  invitedUserId: z.string().optional(),
  invitedByName: z.string().optional(),
  invitedByAvatarUrl: z.string().optional(),
  role: z.string().optional(),
  inviteEmail: z.string().optional(),
});

export const WorkspaceDeletedEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  deletedById: z.string().min(1),
});

// ── Task events ───────────────────────────────────────────────────────────────

export const TaskAssignedEventSchema = EventEnvelopeSchema.extend({
  taskId: z.string().min(1),
  taskTitle: z.string(),
  workspaceId: z.string().min(1),
  recipientId: z.string().min(1),
  actorId: z.string().min(1),
  actorName: z.string(),
  actorAvatarUrl: z.string().optional(),
  assignedAt: z.string().min(1),
});

// ── Comment events ────────────────────────────────────────────────────────────

const CommentEventBase = EventEnvelopeSchema.extend({
  taskId: z.string().min(1),
  taskTitle: z.string(),
  recipientId: z.string().min(1),
  actorId: z.string().min(1),
  actorName: z.string(),
  actorAvatarUrl: z.string().optional(),
  commentId: z.string().min(1),
  commentPreview: z.string(),
  createdAt: z.string().min(1),
});

export const TaskCommentedEventSchema = CommentEventBase;
export const CommentMentionedEventSchema = CommentEventBase;

// ── User events ───────────────────────────────────────────────────────────────

export const UserRegisteredEventSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().optional(),
  username: z.string().nullish(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  occurredAt: z.string().optional(),
});

export const UserProfileUpdatedEventSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().optional(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  username: z.string().nullish(),
  email: z.string().optional(),
  isActive: z.boolean().optional(),
  occurredAt: z.string().optional(),
});

// ── Inferred types (stay in sync with interfaces automatically) ───────────────

export type WorkspaceInvitedEventPayloadParsed = z.infer<typeof WorkspaceInvitedEventSchema>;
export type WorkspaceDeletedEventPayloadParsed = z.infer<typeof WorkspaceDeletedEventSchema>;
export type TaskAssignedEventPayloadParsed = z.infer<typeof TaskAssignedEventSchema>;
export type TaskCommentedEventPayloadParsed = z.infer<typeof TaskCommentedEventSchema>;
export type CommentMentionedEventPayloadParsed = z.infer<typeof CommentMentionedEventSchema>;
export type UserRegisteredEventPayloadParsed = z.infer<typeof UserRegisteredEventSchema>;
export type UserProfileUpdatedEventPayloadParsed = z.infer<typeof UserProfileUpdatedEventSchema>;
