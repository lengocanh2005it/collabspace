# Notification Service - Event Architecture

## Event Structure Organization

The Notification Service is designed to handle events from multiple sources. To maintain scalability and readability, events are organized into separate, focused modules:

```
src/domain/events/
├── task-events.ts                 # Task-related events
├── comment-events.ts              # Comment-related events
├── workspace-events.ts            # Workspace-related events
├── attachment-events.ts           # Attachment-related events
├── kafka-event-wrapper.ts         # Generic event wrapper + event types
├── kafka-event-payloads.ts        # DEPRECATED (backward compatibility)
└── index.ts                       # Central export point
```

## Event Categories

### 1. **Task Events** (`task-events.ts`)
Triggered by Task Service when task operations occur:

| Event | Payload | Triggered When |
|-------|---------|---|
| `TaskAssignedEventPayload` | taskId, taskTitle, assigneeId, actorId, actorName | Task assigned to user |
| `TaskStatusChangedEventPayload` | taskId, oldStatus, newStatus, changedBy | Task status changes |
| `TaskDueDateApproachingEventPayload` | taskId, dueDate, assigneeId | Due date is approaching |
| `TaskDeletedEventPayload` | taskId, deletedBy, deletedByName | Task is deleted |
| `TaskCreatedEventPayload` | taskId, taskTitle, createdBy, priority | New task created |
| `TaskUpdatedEventPayload` | taskId, changes[], updatedBy | Task details updated |

### 2. **Comment Events** (`comment-events.ts`)
Triggered by Task Service when comment operations occur:

| Event | Payload | Triggered When |
|-------|---------|---|
| `CommentAddedEventPayload` | commentId, taskId, authorId, content, mentionedUserIds | New comment added |
| `CommentRepliedEventPayload` | commentId, parentCommentId, authorId, content | Reply to comment |
| `CommentMentionedEventPayload` | commentId, mentionedUserIds, authorId | User mentioned in comment |
| `CommentEditedEventPayload` | commentId, newContent, oldContent, editedAt | Comment content edited |
| `CommentDeletedEventPayload` | commentId, deletedBy, deletedByName | Comment deleted |
| `CommentReactionAddedEventPayload` | commentId, reactionType, reactedBy | Reaction added to comment |

### 3. **Workspace Events** (`workspace-events.ts`)
Triggered by User/Workspace Service:

| Event | Payload | Triggered When |
|-------|---------|---|
| `WorkspaceInvitedEventPayload` | workspaceId, invitedUserId, invitedById, role | User invited to workspace |
| `WorkspaceMemberJoinedEventPayload` | workspaceId, userId, userName | Member joins workspace |
| `WorkspaceMemberLeftEventPayload` | workspaceId, userId, leftAt | Member leaves workspace |
| `WorkspaceMemberRoleChangedEventPayload` | workspaceId, userId, oldRole, newRole | User role changed |
| `WorkspaceCreatedEventPayload` | workspaceId, workspaceName, createdBy | New workspace created |
| `WorkspaceUpdatedEventPayload` | workspaceId, changes[], updatedBy | Workspace settings updated |
| `WorkspaceDeletedEventPayload` | workspaceId, deletedBy, deletedByName | Workspace deleted |

### 4. **Attachment Events** (`attachment-events.ts`)
Triggered by Task Service when file operations occur:

| Event | Payload | Triggered When |
|-------|---------|---|
| `AttachmentAddedEventPayload` | attachmentId, taskId, uploadedBy, fileName, fileSize | File attached to task |
| `AttachmentDeletedEventPayload` | attachmentId, taskId, deletedBy, fileName | Attachment removed |
| `AttachmentDownloadedEventPayload` | attachmentId, taskId, downloadedBy, downloadCount | File downloaded |

## Event Wrapper Structure

All events are wrapped in a `KafkaEventWrapper<T>` for consistency and traceability:

```typescript
interface KafkaEventWrapper<T = any> {
  eventId: string;           // Unique UUID for this event
  eventType: string;         // e.g., 'task.assigned' (from KafkaEventType enum)
  timestamp: Date;           // When event occurred
  version: string;           // Schema version (e.g., '1.0.0')
  source: string;            // Service that emitted (e.g., 'task-service')
  correlationId?: string;    // For distributed tracing
  payload: T;                // Event-specific data
}
```

### Example Event Structure

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "task.assigned",
  "timestamp": "2026-05-09T10:30:45.123Z",
  "version": "1.0.0",
  "source": "task-service",
  "correlationId": "req-123-abc",
  "payload": {
    "taskId": "task-001",
    "taskTitle": "Implement payment feature",
    "assigneeId": "user-456",
    "actorId": "user-789",
    "actorName": "John Manager",
    "actorAvatarUrl": "https://...",
    "workspaceId": "workspace-001"
  }
}
```

## Event Type Enum

Use the `KafkaEventType` enum for type-safe event handling:

```typescript
enum KafkaEventType {
  // Task events
  TASK_ASSIGNED = 'task.assigned',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_DUE_DATE_APPROACHING = 'task.due_date_approaching',
  TASK_DELETED = 'task.deleted',
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',

  // Comment events
  COMMENT_ADDED = 'comment.added',
  COMMENT_REPLIED = 'comment.replied',
  COMMENT_MENTIONED = 'comment.mentioned',
  COMMENT_EDITED = 'comment.edited',
  COMMENT_DELETED = 'comment.deleted',
  COMMENT_REACTION_ADDED = 'comment.reaction_added',

  // Workspace events
  WORKSPACE_INVITED = 'workspace.invited',
  WORKSPACE_MEMBER_JOINED = 'workspace.member_joined',
  // ... (7 workspace events total)

  // Attachment events
  ATTACHMENT_ADDED = 'attachment.added',
  ATTACHMENT_DELETED = 'attachment.deleted',
  ATTACHMENT_DOWNLOADED = 'attachment.downloaded',

  // System events
  SYSTEM_ALERT = 'system.alert',
}
```

## Importing Events

### Recommended: Import from specific modules (Type-safe)
```typescript
import { TaskAssignedEventPayload } from '../domain/events/task-events';
import { CommentAddedEventPayload } from '../domain/events/comment-events';
import { KafkaEventType, KafkaEventWrapper } from '../domain/events/kafka-event-wrapper';
```

### Alternative: Import all from index (Convenience)
```typescript
import {
  TaskAssignedEventPayload,
  CommentAddedEventPayload,
  KafkaEventType,
  KafkaEventWrapper,
} from '../domain/events';
```

### Legacy (Backward compatibility - not recommended)
```typescript
import { TaskAssignedEventPayload } from '../domain/events/kafka-event-payloads';
```

## Creating Events (Usage in Task Service)

```typescript
import { createKafkaEventWrapper, KafkaEventType } from '@notification-service/domain/events';
import { TaskAssignedEventPayload } from '@notification-service/domain/events/task-events';

// When assigning a task
const taskAssignedPayload: TaskAssignedEventPayload = {
  taskId: 'task-001',
  taskTitle: 'Build API',
  assigneeId: 'user-456',
  actorId: 'user-789',
  actorName: 'John Manager',
  actorAvatarUrl: 'https://...',
  workspaceId: 'workspace-001',
};

const event = createKafkaEventWrapper(
  KafkaEventType.TASK_ASSIGNED,
  taskAssignedPayload,
  'task-service',
  '1.0.0',
  'correlation-id-123',
);

// Publish to Kafka
await kafkaProducer.send({
  topic: 'task-events',
  messages: [
    {
      key: taskAssignedPayload.assigneeId,
      value: JSON.stringify(event),
    },
  ],
});
```

## Handling Events (Usage in Notification Service)

```typescript
import { KafkaEventType, KafkaEventWrapper } from '../domain/events';
import { TaskAssignedEventPayload } from '../domain/events/task-events';

@MessagePattern('task-events')
async handleTaskEvent(event: KafkaEventWrapper) {
  console.log(`Received event: ${event.eventType}`);

  switch (event.eventType) {
    case KafkaEventType.TASK_ASSIGNED:
      return this.handleTaskAssigned(event as KafkaEventWrapper<TaskAssignedEventPayload>);

    case KafkaEventType.TASK_STATUS_CHANGED:
      return this.handleTaskStatusChanged(event as KafkaEventWrapper<TaskStatusChangedEventPayload>);

    // ... other cases

    default:
      console.warn(`Unknown event type: ${event.eventType}`);
  }
}

private async handleTaskAssigned(event: KafkaEventWrapper<TaskAssignedEventPayload>) {
  const { payload } = event;

  // Create notification
  const command = new CreateNotificationCommand(
    payload.assigneeId,           // recipient
    payload.actorId,              // actor
    NotificationType.TASK_ASSIGNED,
    `You've been assigned to "${payload.taskTitle}"`,
    `${payload.actorName} assigned you to this task`,
    payload.taskId,
    'TASK',
    {
      actorName: payload.actorName,
      actorAvatarUrl: payload.actorAvatarUrl,
      taskTitle: payload.taskTitle,
    },
  );

  await this.commandBus.execute(command);

  // Broadcast via WebSocket
  this.notificationGateway.sendNotificationToUser(
    payload.assigneeId,
    'new_notification',
    { taskId: payload.taskId, message: `Assigned to ${payload.taskTitle}` },
  );
}
```

## Scalability Considerations

### 1. **Partitioning by User** (Current Design)
- Kafka partitions events by `recipientId` or `assigneeId`
- Ensures all notifications for a user go to same partition
- Maintains ordering within user's notification stream
- Multiple service instances can process different partitions in parallel

### 2. **Adding New Event Type**
Simply create new file `src/domain/events/{feature}-events.ts` with:
```typescript
export interface NewFeatureEventPayload {
  // Define fields
}
```

Then add to `KafkaEventType` enum and export from `index.ts`

### 3. **Event Schema Versioning**
- Use `version` field to track schema evolution
- Handle multiple versions in handlers (e.g., v1.0.0, v2.0.0)
- Graceful degradation for old events

### 4. **Dead Letter Queue (DLQ)**
- Handle events that fail processing
- Retry logic with exponential backoff
- Store to DLQ after max retries

## File Organization Benefits

✅ **Maintainability**: Each feature has isolated event definitions
✅ **Scalability**: Easy to add new events without modifying core files
✅ **Readability**: Clear separation of concerns
✅ **Type Safety**: Strong typing within each module
✅ **Testing**: Can test each event type independently
✅ **Documentation**: Self-documenting file structure

---

**Last Updated:** May 9, 2026
**Version:** 1.0.0
**Author:** Võ Trung Tín (Member 4)
