# Task Service - Complete CRUD API

A production-ready Task Management API built with **Clean Architecture + CQRS** pattern using NestJS and MongoDB.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start development server
npm run start:dev

# Visit API docs
open http://localhost:3000/api/docs
```

## 📋 Features

✅ **Full CRUD Operations**
- Create, Read (single/list), Update, Delete

✅ **Intent-Based Endpoints**
- Separate endpoints for each business action
- `/tasks/:id/details` for title/description
- `/tasks/:id/status` for status changes
- `/tasks/:id/assignee` for user assignment

✅ **Clean Architecture**
- Domain Layer: Business logic & rules
- Application Layer: CQRS Commands/Queries
- Infrastructure Layer: Data access
- Presentation Layer: HTTP API

✅ **Business Rules**
- Status transitions validated
- Immutable value objects
- Domain exceptions

✅ **Type Safety**
- Full TypeScript
- class-validator DTOs
- Strict null checks

✅ **API Documentation**
- Swagger/OpenAPI at `/api/docs`
- Complete endpoint reference
- Request/response examples

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design & patterns |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | How to extend & debug |
| [API_DOCUMENTATION.ts](./API_DOCUMENTATION.ts) | Endpoint reference |
| [PROJECT_COMPLETION_REPORT.md](./PROJECT_COMPLETION_REPORT.md) | Implementation report |
| [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) | Verification checklist |

## 🔌 API Endpoints

```
POST   /v1/tasks                 Create task
GET    /v1/tasks                 List tasks (with filters)
GET    /v1/tasks/:id             Get single task
PATCH  /v1/tasks/:id/details     Update title/description
PATCH  /v1/tasks/:id/status      Change status
PATCH  /v1/tasks/:id/assignee    Assign/unassign user
DELETE /v1/tasks/:id             Delete task
```

## 🧪 Testing

```bash
# Run automated tests
bash test-api.sh

# Or manually
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Task",
    "description": "Task description",
    "workspaceId": "507f1f77bcf86cd799439011"
  }'
```

## 🏗️ Project Structure

```
src/
├── domain/              # Business logic
├── application/         # CQRS commands/queries
├── infrastructure/      # Data access
└── presentation/        # HTTP API
```

## 🛠️ Development

### Add New Command
1. Create command in `application/commands/`
2. Create handler in `application/usecases/`
3. Register in `app.module.ts`
4. Add endpoint in controller

### Add New Query
Follow similar pattern as commands

### Modify Business Logic
- Add methods to `Task` entity
- Use domain exceptions for violations
- Handlers call domain methods

## 📦 Stack

- **NestJS 11** - Framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **CQRS** - Pattern
- **class-validator** - Validation
- **Swagger** - API docs

## 📝 Environment

```bash
# .env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://mongo:27017/collabspace_task
JWT_SECRET=your-secret-key
```

## 🚨 Error Handling

The API returns meaningful error messages:

```json
{
  "statusCode": 400,
  "message": "Business Rule Violated: Cannot move from DONE to TODO",
  "error": "Bad Request"
}
```

## 📈 Next Steps

- Add authentication middleware
- Implement domain events
- Add comprehensive logging
- Create unit tests
- Implement caching
- Add pagination

## 📄 License

ISC

---

**Status**: ✅ Production Ready  
**Last Updated**: May 3, 2026
