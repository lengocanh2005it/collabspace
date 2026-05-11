# Task Service - Complete CRUD with Clean Architecture + CQRS

## 🎯 Overview

This Task Service implements a complete CRUD API following Clean Architecture and CQRS patterns. Instead of monolithic update endpoints, it uses **intent-based updates** where each specific action (change status, assign user) has its own dedicated endpoint.

## 🏗️ Architecture Layers

### 1. **Domain Layer** (`src/domain/`)
- **Entities**: `Task` (Aggregate Root with business logic)
- **Value Objects**: 
  - `TaskId`: Immutable task identifier (UUID)
  - `TaskStatus`: Enforces valid status transitions (TODO → DOING → DONE)
  - `UserSnapshot`: Immutable user reference
- **Exceptions**: Domain-specific exceptions
- **Business Rules**:
  - ✅ Cannot transition from DONE back to TODO
  - ✅ Task title is required
  - ✅ Workspace ID is mandatory

### 2. **Application Layer** (`src/application/`)
- **Commands** (Write Operations):
  - `CreateTaskCommand` → `CreateTaskHandler`
  - `UpdateTaskDetailsCommand` → `UpdateTaskDetailsHandler`
  - `ChangeTaskStatusCommand` → `ChangeTaskStatusHandler`
  - `AssignTaskCommand` → `AssignTaskHandler`
  - `DeleteTaskCommand` → `DeleteTaskHandler`

- **Queries** (Read Operations):
  - `GetTaskByIdQuery` → `GetTaskByIdHandler`
  - `GetTasksQuery` → `GetTasksHandler` (with filtering)

- **Ports**: `ITaskRepository` (interface for Repository pattern)

### 3. **Infrastructure Layer** (`src/infrastructure/`)
- **Adapter**: `MongoTaskRepository` implements `ITaskRepository`
- **Mapper**: `TaskMapper` converts between Domain and Persistence models
- **Schema**: `TaskPersistence` MongoDB document model

### 4. **Presentation Layer** (`src/presentation/`)
- **Controller**: `TaskController` with all endpoints
- **DTOs**:
  - `CreateTaskRequest/Response`
  - `UpdateTaskDetailsRequest`
  - `ChangeTaskStatusRequest`
  - `AssignTaskRequest`
  - `TaskResponse` (unified response object)
- **Response Wrapper**: Consistent API response format

## 📋 API Endpoints

```
POST   /v1/tasks                    Create new task
GET    /v1/tasks                    List tasks with filters (status, assignee)
GET    /v1/tasks/:id                Get task by ID
PATCH  /v1/tasks/:id/details        Update title/description
PATCH  /v1/tasks/:id/status         Change task status
PATCH  /v1/tasks/:id/assignee       Assign/unassign user
DELETE /v1/tasks/:id                Delete task
```

### Request/Response Examples

#### Create Task
```bash
POST /v1/tasks
Content-Type: application/json

{
  "title": "Fix login bug",
  "description": "Users cannot login with email",
  "workspaceId": "507f1f77bcf86cd799439011"
}

# Response 201
{
  "success": true,
  "message": "Tạo công việc thành công",
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Get Tasks with Filters
```bash
GET /v1/tasks?workspaceId=507f1f77bcf86cd799439011&status=TODO&assigneeId=user-123
```

#### Change Status
```bash
PATCH /v1/tasks/550e8400-e29b-41d4-a716-446655440000/status
Content-Type: application/json

{
  "status": "DOING"
}
```

#### Assign Task
```bash
PATCH /v1/tasks/550e8400-e29b-41d4-a716-446655440000/assignee
Content-Type: application/json

{
  "assigneeId": "user-456",
  "assigneeName": "John Doe",
  "assigneeAvatarUrl": "https://example.com/avatar.jpg"
}
```

#### Unassign Task
```bash
PATCH /v1/tasks/550e8400-e29b-41d4-a716-446655440000/assignee
Content-Type: application/json

{
  "assigneeId": null
}
```

## 🔄 CQRS Pattern Benefits

1. **Separate Concerns**: Queries and Commands follow different logic paths
2. **Scalability**: Read and write operations can be scaled independently
3. **Clarity**: Each endpoint represents a specific user intent
4. **Auditability**: Easier to track what operations were performed
5. **Testing**: Handlers can be tested independently

## ✅ Key Features

- ✅ **Full CRUD**: All Create, Read, Update, Delete operations
- ✅ **Business Logic**: Status transitions validated in Domain
- ✅ **Type Safety**: TypeScript with strict typing
- ✅ **Validation**: class-validator on DTOs
- ✅ **Error Handling**: Domain exceptions propagated to API
- ✅ **Filtering**: Filter tasks by status, assignee, workspace
- ✅ **Clean Code**: No anemic models or service layers
- ✅ **Maintainability**: Easy to add new commands/queries

## 🚀 Running the Service

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB URI

# Development mode (with watch)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## 📁 Project Structure

```
src/
├── domain/                 # Business logic & rules
│   ├── entities/          # Task entity
│   ├── value-objects/     # TaskId, TaskStatus, UserSnapshot
│   └── exceptions/        # Domain exceptions
├── application/           # Business logic orchestration
│   ├── commands/          # Command definitions
│   ├── queries/           # Query definitions
│   ├── usecases/          # Handlers for commands/queries
│   └── ports/             # Repository interface
├── infrastructure/        # Technical implementations
│   ├── persistence/       # MongoDB schema
│   ├── repositories/      # Repository implementations
│   └── mappers/           # Domain ↔ Persistence conversion
├── presentation/          # HTTP layer
│   ├── controllers/       # API endpoints
│   ├── dtos/              # Data transfer objects
│   └── common/            # Response wrappers
├── app.module.ts          # NestJS module configuration
└── main.ts               # Application entry point
```

## 📝 Database Schema

```typescript
{
  _id: string (UUID),
  title: string,
  description: string,
  status: 'TODO' | 'DOING' | 'DONE',
  workspaceId: string,
  assigneeId: string | null,
  createdBy: {
    userId: string,
    name: string,
    avatarUrl?: string
  },
  assignedTo: {
    userId: string,
    name: string,
    avatarUrl?: string
  } | null,
  createdAt: Date,
  updatedAt: Date
}
```

## 🧪 Testing Commands

```bash
# Create task
curl -X POST http://localhost:3000/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Test description",
    "workspaceId": "507f1f77bcf86cd799439011"
  }'

# List tasks
curl http://localhost:3000/v1/tasks?workspaceId=507f1f77bcf86cd799439011

# Change status
curl -X PATCH http://localhost:3000/v1/tasks/{taskId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "DOING"}'

# Assign task
curl -X PATCH http://localhost:3000/v1/tasks/{taskId}/assignee \
  -H "Content-Type: application/json" \
  -d '{
    "assigneeId": "user-123",
    "assigneeName": "John Doe"
  }'

# Delete task
curl -X DELETE http://localhost:3000/v1/tasks/{taskId}
```

## 🎓 Design Patterns Used

1. **Aggregate Root**: Task entity encapsulates related objects
2. **Repository Pattern**: Data access abstraction via ITaskRepository
3. **Mapper Pattern**: Separation of Domain and Persistence models
4. **CQRS**: Command Query Responsibility Segregation
5. **Command Bus**: Centralized command execution
6. **Query Bus**: Centralized query execution
7. **Dependency Injection**: NestJS provides IoC container
8. **Value Objects**: TaskId, TaskStatus enforce invariants
9. **Domain Events**: Ready for future event publishing

## 📚 Next Steps

1. Add authentication/authorization to controllers
2. Implement domain events for task creation/updates
3. Add pagination to list endpoint
4. Implement caching for read-heavy operations
5. Add comprehensive error handling and logging
6. Create integration tests for handlers
7. Add API documentation with Swagger/OpenAPI
8. Implement soft-delete functionality
9. Add activity logging/audit trail
10. Implement task comments support (TaskComment entity already defined)

## 📄 License

ISC
