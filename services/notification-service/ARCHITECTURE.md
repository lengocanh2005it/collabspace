# Notification Service - Architecture & Implementation Guide

## Overview

The Notification Service is the "nervous system" of the CollabSpace application, responsible for:
- **Publishing notifications** when events occur (task assigned, comment added, etc.)
- **Persisting notifications** in MongoDB for historical reference
- **Broadcasting in real-time** via WebSocket to connected clients
- **Integrating with Kafka** to consume events from other services

## Architecture Layers

### 1. Domain Layer (`src/domain/`)
**Purpose:** Pure business logic, framework-independent

#### Entities
- **`Notification.ts`**: Domain entity with business rules
  - Factory methods: `create()`, `restore()`
  - Actions: `markAsRead()`, `markAsUnread()`, `archive()`
  - Query methods: `isUnread()`, `isRead()`
  - Immutable getters for all properties

#### Value Objects
- **`NotificationType.ts`**: Enum of notification types
  - `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `TASK_DUE_DATE_APPROACHING`
  - `COMMENT_ADDED`, `COMMENT_REPLIED`, `COMMENT_MENTIONED`
  - `ATTACHMENT_ADDED`
  - `WORKSPACE_INVITED`, `WORKSPACE_MEMBER_JOINED`
  - `SYSTEM_ALERT`

- **`NotificationStatus.ts`**: Notification states
  - `UNREAD`, `READ`, `ARCHIVED`

#### Repositories
- **`INotificationRepository`**: Port interface
  - `createAsync()`, `findByIdAsync()`, `findByRecipientIdAsync()`
  - `findUnreadByRecipientIdAsync()`, `countUnreadByRecipientIdAsync()`
  - `updateAsync()`, `deleteAsync()`
  - `markAllAsReadAsync()`, `findByTypeAsync()`
  - `deleteOldNotificationsAsync()`

#### Events
- **`kafka-event-payloads.ts`**: Kafka event contracts
  - `TaskAssignedEventPayload`, `CommentAddedEventPayload`
  - `WorkspaceInvitedEventPayload`, etc.
  - `KafkaEventWrapper<T>`: Generic event wrapper

### 2. Application Layer (`src/application/`)
**Purpose:** Use cases, CQRS commands/queries, business logic orchestration

#### CQRS Commands & Handlers

**CreateNotificationCommand/Handler**
- Input: `recipientId`, `actorId`, `type`, `title`, `message`, `targetId`, `targetType`, `metadata`
- Output: `notificationId`, success message
- Triggered by: Kafka event consumers (Phase 3)

**GetNotificationsQuery/Handler**
- Input: `recipientId`, `skip`, `limit`
- Output: List of notifications with pagination, unread count
- Used by: REST API endpoints

**MarkAsReadCommand/Handler** (Phase 2+)
- Input: `notificationId`, `recipientId`
- Output: Updated notification
- Used by: REST API

### 3. Infrastructure Layer (`src/infrastructure/`)
**Purpose:** External services, persistence adapters

#### Database
- **`schemas/notification.schema.ts`**: Mongoose schema
  - Fields: `recipientId`, `actorId`, `type`, `title`, `message`, `targetId`, `targetType`, `status`, `metadata`, `createdAt`, `updatedAt`
  - Indexes: 
    - `(recipientId, createdAt)` - fastest lookup
    - `(recipientId, status)` - for unread queries
    - `(createdAt)` - for cleanup
    - `(targetId, targetType)` - for resource-specific queries

- **`repositories/notification.repository.ts`**: MongoDB adapter
  - Implements `INotificationRepository`
  - Uses Mongoose Model for all DB operations
  - Converts Domain Entity ↔ Persistence Document

- **`mappers/notification.mapper.ts`**: Conversion utilities
  - `toPersistence()`: Entity → Document
  - `toDomain()`: Document → Entity
  - `toResponse()`: Document → DTO

#### Kafka (Phase 3)
- **`kafka/notification.kafka.controller.ts`**: Kafka consumer
  - Listen on: `notification.topic`
  - Handle: Task assigned, comment added, workspace invited events
  - Call: Command handlers to create notifications + Gateway to emit WebSocket

#### Services (Phase 4)
- **`services/notification.service.ts`**: Business logic aggregator
  - Orchest integration between Repository, Repository → Gateway
  - Trigger WebSocket broadcasts

### 4. Presentation Layer (`src/presentation/`)
**Purpose:** REST API, WebSocket Gateway, DTOs

#### Controllers (Phase 5)
- **`controllers/notification.rest.controller.ts`**: REST endpoints
  - `GET /notifications`: Get user's notifications
  - `PATCH /notifications/:id/read`: Mark single as read
  - `PATCH /notifications/read-all`: Mark all as read
  - `GET /notifications/unread-count`: Get badge count
  - `GET /notifications/unread`: Get only unread

#### WebSocket Gateway (Phase 4)
- **`gateways/notification.gateway.ts`**: Socket.io gateway
  - Authentication via JWT token
  - Rooms: `user:{userId}` for targeted broadcasts
  - Events:
    - `new_notification`: Server → Client (new notification)
    - `notification_read`: Server → Client (notification marked as read)
    - `notifications_cleared`: Server → Client (all marked as read)

#### DTOs
- **`dtos/create-notification.request.ts`**: Request validation
- **`dtos/notification.response.ts`**: API response DTO
- **`dtos/get-notifications-query.dto.ts`**: Query parameters

## Data Flow

### 1. Event Reception (Kafka)
```
Task Service                    Notification Service
  │                                    │
  ├─ TASK_ASSIGNED event          ← Kafka Consumer
  │   {taskId, assigneeId, ...}      │
  │                                  ├─ Parse payload
  │                                  ├─ Create notification
  │                                  └─ Save to MongoDB
```

### 2. Real-Time Broadcast (WebSocket)
```
                          Notification Service
                                    │
                          ├─ Create notification
                          ├─ Save to DB
                          └─ Emit via Gateway
                                    │
                                    └─ `io.to(recipientId).emit('new_notification', data)`
                                            │
                                         ┌──┴──┐
                                         │     │
                                    Client-1  Client-2
                                    (Toast)   (Toast)
```

### 3. REST Query (Polling)
```
Frontend                           Notification Service
  │                                        │
  ├─ GET /notifications?skip=0&limit=20 → │
  │                                        ├─ Query MongoDB
  │                                        ├─ Convert to DTOs
  │ ← {notifications: [...], unreadCount: 5}
  │
  └─ Show notification list + badge
```

## Scalability Strategies

### 1. **Database Optimization**
- Compound indexes for fast lookups
- Pagination with skip/limit to reduce memory
- Auto-delete old notifications (configurable retention: 30 days default)

### 2. **Kafka Partitioning**
- Partition by `recipientId` → each partition processes notifications for subset of users
- Allows horizontal scaling: N Notification Service replicas handle N Kafka partitions

### 3. **WebSocket Rooms**
- Room per user: `user:{userId}`
- No broadcast storm: Only specific user receives their notification
- Reconnection handling: Re-join room on reconnect

### 4. **Caching** (Optional Phase)
- Redis cache for unread count
- Cache invalidation on read/mark-as-read
- Reduces database load for frequently-checked badge counts

### 5. **Message Batching** (Optional)
- Batch notifications sent in single WebSocket message
- Reduce network overhead for high-volume scenarios

## Implementation Phases

### Phase 1: Domain Layer ✅
- ✅ Notification entity with business logic
- ✅ Repository interface
- ✅ Value objects (Type, Status)
- ✅ Event payloads

### Phase 2: Infrastructure Layer ✅
- ✅ MongoDB schema with indexes
- ✅ Repository implementation
- ✅ Notification mapper

### Phase 3: CQRS & Application Layer ✅
- ✅ CreateNotificationCommand/Handler
- ✅ GetNotificationsQuery/Handler
- 🔄 MarkAsReadCommand/Handler (Next)
- 🔄 Kafka Consumer (Next)

### Phase 4: WebSocket Gateway
- ⏳ NotificationGateway with Socket.io
- ⏳ Authentication middleware
- ⏳ Room management
- ⏳ Integration with handlers

### Phase 5: REST API
- ⏳ NotificationRestController
- ⏳ Get notifications endpoint
- ⏳ Mark as read endpoints
- ⏳ Unread count endpoint

### Phase 6: Kafka Integration
- ⏳ Kafka consumer pattern setup
- ⏳ Event handlers for Task/Comment/Workspace events
- ⏳ Orchestration logic

## Testing Checklist

### Unit Tests
- [ ] Notification entity: create, markAsRead, markAsUnread
- [ ] Repository: CRUD operations, filtering
- [ ] Handlers: Command/Query execution

### Integration Tests
- [ ] MongoDB persistence
- [ ] CQRS bus execution
- [ ] Kafka event consumption

### End-to-End Tests
- [ ] Task → Kafka → Notification Service → MongoDB
- [ ] WebSocket real-time broadcast
- [ ] REST API retrieval
- [ ] Unread badge accuracy

## Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/notifications
KAFKA_BROKERS=localhost:9092
KAFKA_CONSUMER_GROUP=notification-service
KAFKA_NOTIFICATION_TOPIC=notification.topic
JWT_PUBLIC_KEY=<your-jwt-public-key>
PORT=3002
NOTIFICATION_RETENTION_DAYS=30
```

## Next Steps

1. **Implement MarkAsRead & MarkAllAsRead handlers**
2. **Create Kafka consumer with event handlers**
3. **Build WebSocket Gateway with authentication**
4. **Create REST API Controller**
5. **Wire everything together in AppModule**
6. **Add comprehensive testing**

## File Structure Summary

```
src/
├── domain/
│   ├── entities/
│   │   └── Notification.ts
│   ├── repositories/
│   │   └── INotificationRepository.ts
│   ├── value-objects/
│   │   ├── NotificationType.ts
│   │   └── NotificationStatus.ts
│   └── events/
│       └── kafka-event-payloads.ts
├── application/
│   └── usecases/
│       ├── create-notification/
│       ├── get-notifications/
│       ├── mark-as-read/ (Phase 2)
│       └── mark-all-as-read/ (Phase 2)
├── infrastructure/
│   ├── database/
│   │   ├── schemas/
│   │   │   └── notification.schema.ts
│   │   └── repositories/
│   │       └── notification.repository.ts
│   ├── mappers/
│   │   └── notification.mapper.ts
│   ├── kafka/ (Phase 3)
│   │   └── notification.kafka.controller.ts
│   └── services/
│       └── notification.service.ts (Phase 3)
├── presentation/
│   ├── controllers/ (Phase 5)
│   │   └── notification.rest.controller.ts
│   ├── gateways/ (Phase 4)
│   │   └── notification.gateway.ts
│   └── dtos/
│       ├── create-notification.request.ts
│       ├── notification.response.ts
│       └── get-notifications-query.dto.ts
├── app.module.ts
└── main.ts
```

---

## Key Design Decisions

1. **Soft Delete not used for notifications** - Unlike comments, notifications are more ephemeral and can be hard deleted after retention period
2. **Metadata field for flexibility** - Allows storing actor name, avatar, task priority without schema changes
3. **Separate `actorId` from recipient** - Enables "X did Y" narrative (actor → action → recipient)
4. **Kafka partition by recipientId** - Ensures notifications for same user go to same partition (ordering guarantee)
5. **WebSocket rooms per user** - Scalable pub/sub without needing Redis initially

---

**Estimated Timeline:** 3-4 days of focused development
**Team Member:** Võ Trung Tín (Member 4)
**Status:** Phase 1-2 Complete ✅, Phase 3 In Progress 🔄
