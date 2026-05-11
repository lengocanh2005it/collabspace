# Task Service - Development Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- MongoDB 6.0+
- Git

### Installation

```bash
# 1. Clone and navigate to the service
cd services/task-service

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env

# 4. Edit .env with your values
# For local development with docker-compose:
# MONGO_URI=mongodb://mongo:27017/collabspace_task

# 5. Start development server
npm run start:dev

# Server runs at: http://localhost:3000
# API Docs at: http://localhost:3000/api/docs
```

## 📦 Dependencies

```json
{
  "@nestjs/common": "^11.1.19",          // Core NestJS framework
  "@nestjs/cqrs": "^11.0.3",            // CQRS pattern support
  "@nestjs/mongoose": "^11.0.4",        // MongoDB integration
  "@nestjs/swagger": "^11.4.2",         // API documentation
  "class-validator": "^0.15.1",         // DTO validation
  "mongoose": "^9.6.1",                 // MongoDB ODM
  "uuid": "^14.0.0"                     // UUID generation
}
```

## 🗂️ Project Structure

```
src/
├── domain/                          # Business Logic
│   ├── entities/
│   │   ├── Task.ts                 # Main aggregate root
│   │   └── TaskComment.ts          # Comment entity
│   ├── value-objects/
│   │   ├── TaskId.ts               # Immutable task ID
│   │   ├── TaskStatus.ts           # Status enum with validation
│   │   └── UserSnapshot.ts         # Immutable user reference
│   └── exceptions/
│       ├── BusinessRuleException.ts
│       ├── EntityNotFoundException.ts
│       └── DomainException.ts
│
├── application/                     # Use Cases & Orchestration
│   ├── commands/                   # Command definitions
│   │   ├── create-task.command.ts
│   │   ├── update-task-details.command.ts
│   │   ├── change-task-status.command.ts
│   │   ├── assign-task.command.ts
│   │   └── delete-task.command.ts
│   ├── queries/                    # Query definitions
│   │   ├── get-task-by-id.query.ts
│   │   └── get-tasks.query.ts
│   ├── usecases/                   # Command & Query Handlers
│   │   ├── create-task.handler.ts
│   │   ├── update-task-details.handler.ts
│   │   ├── change-task-status.handler.ts
│   │   ├── assign-task.handler.ts
│   │   ├── delete-task.handler.ts
│   │   ├── get-task-by-id.handler.ts
│   │   └── get-tasks.handler.ts
│   └── ports/
│       └── ITaskRepository.ts      # Repository interface
│
├── infrastructure/                  # Technical Implementation
│   ├── persistence/
│   │   └── task.schema.ts          # MongoDB schema
│   ├── repositories/
│   │   └── mongo-task.repository.ts # MongoDB adapter
│   └── mappers/
│       └── task.mapper.ts          # Domain ↔ Persistence conversion
│
├── presentation/                    # HTTP API Layer
│   ├── controllers/
│   │   └── task.controller.ts      # All endpoints
│   ├── dtos/                       # Data transfer objects
│   │   ├── create-task.request.ts
│   │   ├── update-task-details.request.ts
│   │   ├── change-task-status.request.ts
│   │   ├── assign-task.request.ts
│   │   ├── task.response.ts
│   │   ├── get-tasks.response.ts
│   │   └── create-task.response.ts
│   └── common/
│       └── response/
│           ├── api-response.interface.ts
│           ├── api-response.wrapper.ts
│           └── response.helper.ts
│
├── app.module.ts                   # NestJS module configuration
└── main.ts                         # Application entry point
```

## 🔄 How CQRS Works Here

### Command Flow (Write Operations)

```
Controller
   ↓
Create Command
   ↓
CommandBus.execute()
   ↓
Handler (business logic)
   ↓
Domain Entity (validates)
   ↓
Repository (saves to DB)
   ↓
Response to Controller
```

**Example**: Creating a task
```typescript
// 1. Controller receives POST request
@Post()
async createTask(@Body() request: CreateTaskRequest) {
  // 2. Creates command
  const command = new CreateTaskCommand(...);
  
  // 3. Executes via bus
  const taskId = await this.commandBus.execute(command);
}

// 4. Handler handles the command
@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler {
  async execute(command: CreateTaskCommand) {
    // 5. Domain logic
    const task = Task.create(id, title, ...);
    
    // 6. Repository saves
    await this.repository.addAsync(task);
  }
}
```

### Query Flow (Read Operations)

```
Controller
   ↓
Create Query
   ↓
QueryBus.execute()
   ↓
Handler (retrieves data)
   ↓
Repository (queries DB)
   ↓
Mapper (converts to DTO)
   ↓
Response to Controller
```

**Example**: Getting task by ID
```typescript
// 1. Controller receives GET request
@Get(':id')
async getTaskById(@Param('id') taskId: string) {
  // 2. Creates query
  const query = new GetTaskByIdQuery(taskId);
  
  // 3. Executes via bus
  const task = await this.queryBus.execute(query);
}

// 4. Handler handles the query
@QueryHandler(GetTaskByIdQuery)
export class GetTaskByIdHandler {
  async execute(query: GetTaskByIdQuery) {
    // 5. Repository retrieves
    const task = await this.repository.findByIdAsync(id);
    
    // 6. Maps to response
    return TaskMapper.toResponse(task);
  }
}
```

## 🎯 Common Development Tasks

### Adding a New Command

1. **Create Command class** (`src/application/commands/my-action.command.ts`):
```typescript
export class MyActionCommand {
  constructor(
    public readonly taskId: string,
    public readonly newData: string
  ) {}
}
```

2. **Create Handler** (`src/application/usecases/my-action.handler.ts`):
```typescript
@CommandHandler(MyActionCommand)
export class MyActionHandler implements ICommandHandler<MyActionCommand> {
  constructor(@Inject(ITaskRepository) private repo: ITaskRepository) {}

  async execute(command: MyActionCommand): Promise<void> {
    const task = await this.repo.findByIdAsync(new TaskId(command.taskId));
    if (!task) throw new EntityNotFoundException('Task', command.taskId);
    
    // Business logic
    task.myAction(command.newData);
    
    await this.repo.updateAsync(task);
  }
}
```

3. **Register Handler** in `app.module.ts`:
```typescript
import { MyActionHandler } from './application/usecases/my-action.handler';

@Module({
  providers: [MyActionHandler, ...]
})
export class AppModule {}
```

4. **Add endpoint in Controller**:
```typescript
@Patch(':id/my-action')
async myAction(@Param('id') taskId: string, @Body() data: MyActionRequest) {
  const command = new MyActionCommand(taskId, data.newData);
  await this.commandBus.execute(command);
  return ok({ message: 'Success' });
}
```

### Adding a New Query

1. **Create Query class** (`src/application/queries/my-query.query.ts`):
```typescript
export class MyQuery {
  constructor(public readonly param: string) {}
}
```

2. **Create Handler** (`src/application/usecases/my-query.handler.ts`):
```typescript
@QueryHandler(MyQuery)
export class MyQueryHandler implements IQueryHandler<MyQuery> {
  constructor(@Inject(ITaskRepository) private repo: ITaskRepository) {}

  async execute(query: MyQuery): Promise<any> {
    // Retrieve data
    const results = await this.repo.findByWorkspaceIdAsync(query.param);
    
    // Map and return
    return results.map(task => TaskMapper.toResponse(task));
  }
}
```

3. **Register Handler** in `app.module.ts` and add endpoint

### Modifying Domain Logic

All business rules live in the **Domain Layer**:

```typescript
// src/domain/entities/Task.ts

// Adding new method
public myBusinessRule(data: string): void {
  if (!data) throw new BusinessRuleException('Data required');
  // Business logic
  this.updatedAt = new Date();
}

// Update gets called through handlers, not directly in DB
```

## 🧪 Testing

### Unit Testing Commands/Queries

```typescript
describe('CreateTaskHandler', () => {
  let handler: CreateTaskHandler;
  let repository: ITaskRepository;

  beforeEach(() => {
    repository = {
      addAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      // ... other mocks
    };
    handler = new CreateTaskHandler(repository);
  });

  it('should create a task', async () => {
    const command = new CreateTaskCommand('title', 'desc', ...);
    const result = await handler.execute(command);
    
    expect(result).toBeDefined();
    expect(repository.addAsync).toHaveBeenCalled();
  });
});
```

### Integration Testing with API

```bash
# Using the provided test script
bash test-api.sh http://localhost:3000/api

# Or with cURL
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "workspaceId": "123"}'
```

## 🐛 Debugging

### Enable Debug Logging

```typescript
// In main.ts
import { Logger } from '@nestjs/common';

const logger = new Logger();
logger.debug('Handler executing', command);
```

### Using VS Code Debugger

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Task Service",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "port": 9229
    }
  ]
}
```

## 📝 Code Standards

### Naming Conventions
- Commands: `VerbNounCommand` (e.g., `CreateTaskCommand`)
- Queries: `NounQuery` (e.g., `GetTasksQuery`)
- Handlers: `VerbNounHandler` (e.g., `CreateTaskHandler`)
- DTOs: `Verb/NounRequest/Response` (e.g., `CreateTaskRequest`)

### File Locations
- Entities: `domain/entities/`
- Value Objects: `domain/value-objects/`
- Exceptions: `domain/exceptions/`
- Commands: `application/commands/`
- Queries: `application/queries/`
- Handlers: `application/usecases/`
- Controllers: `presentation/controllers/`
- DTOs: `presentation/dtos/`

### Code Style
- Use `readonly` for immutable properties
- Use `private` for encapsulation
- Use getters instead of public properties
- Throw domain exceptions for business rule violations
- Return `void` or specific types, never `any`

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [CQRS Pattern](https://docs.nestjs.com/recipes/cqrs)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://en.wikipedia.org/wiki/Domain-driven_design)

## 🤝 Contributing

When adding features:
1. Create a new Command/Query in appropriate folders
2. Create the Handler in `application/usecases/`
3. Add the Handler to `app.module.ts`
4. Add endpoint in `TaskController`
5. Create DTOs if needed
6. Update tests
7. Update documentation

## ⚠️ Common Mistakes

❌ **Don't**: Put business logic in controllers
✅ **Do**: Put business logic in domain entities

❌ **Don't**: Query database directly in handlers
✅ **Do**: Use repository interface

❌ **Don't**: Mix read and write operations
✅ **Do**: Use queries for reads, commands for writes

❌ **Don't**: Return raw database models
✅ **Do**: Map to DTOs via mapper

❌ **Don't**: Leave properties as public
✅ **Do**: Use private with getters

## 📞 Support

For issues or questions:
1. Check ARCHITECTURE.md
2. Review existing handlers
3. Check error messages in domain exceptions
4. Add logging to trace execution flow
