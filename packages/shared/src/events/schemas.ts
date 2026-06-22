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

export const WorkspaceCreatedEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  workspaceName: z.string().min(1),
  ownerId: z.string().min(1),
});

export const WorkspaceProjectCreatedEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  createdBy: z.string().min(1),
});

export const WorkspaceMemberJoinedEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().min(1),
  invitationId: z.string().optional(),
});

export const WorkspaceMemberLeftEventSchema = EventEnvelopeSchema.extend({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().optional(),
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

const TaskStatusSchema = z.enum(['TODO', 'DOING', 'DONE']);

export const TaskCreatedEventSchema = EventEnvelopeSchema.extend({
  taskId: z.string().min(1),
  taskTitle: z.string(),
  workspaceId: z.string().min(1),
  creatorId: z.string().min(1),
  projectId: z.string().nullish(),
  status: TaskStatusSchema,
});

export const TaskStatusChangedEventSchema = EventEnvelopeSchema.extend({
  taskId: z.string().min(1),
  workspaceId: z.string().min(1),
  previousStatus: TaskStatusSchema,
  newStatus: TaskStatusSchema,
  actorId: z.string().optional(),
});

export const TaskDeletedEventSchema = EventEnvelopeSchema.extend({
  taskId: z.string().min(1),
  workspaceId: z.string().min(1),
  status: TaskStatusSchema,
  actorId: z.string().min(1),
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
  eventId: z.string().optional(),
  userId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().optional(),
  username: z.string().nullish(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  occurredAt: z.string().optional(),
});

export const UserProfileUpdatedEventSchema = z.object({
  eventId: z.string().optional(),
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
export type WorkspaceCreatedEventPayloadParsed = z.infer<typeof WorkspaceCreatedEventSchema>;
export type WorkspaceProjectCreatedEventPayloadParsed = z.infer<
  typeof WorkspaceProjectCreatedEventSchema
>;
export type WorkspaceMemberJoinedEventPayloadParsed = z.infer<
  typeof WorkspaceMemberJoinedEventSchema
>;
export type WorkspaceMemberLeftEventPayloadParsed = z.infer<typeof WorkspaceMemberLeftEventSchema>;
export type TaskAssignedEventPayloadParsed = z.infer<typeof TaskAssignedEventSchema>;
export type TaskCreatedEventPayloadParsed = z.infer<typeof TaskCreatedEventSchema>;
export type TaskStatusChangedEventPayloadParsed = z.infer<typeof TaskStatusChangedEventSchema>;
export type TaskDeletedEventPayloadParsed = z.infer<typeof TaskDeletedEventSchema>;
export type TaskCommentedEventPayloadParsed = z.infer<typeof TaskCommentedEventSchema>;
export type CommentMentionedEventPayloadParsed = z.infer<typeof CommentMentionedEventSchema>;
export type UserRegisteredEventPayloadParsed = z.infer<typeof UserRegisteredEventSchema>;
export type UserProfileUpdatedEventPayloadParsed = z.infer<typeof UserProfileUpdatedEventSchema>;
