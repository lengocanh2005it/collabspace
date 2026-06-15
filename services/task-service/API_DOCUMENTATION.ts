// API Endpoints Summary

/**
 * ============================================================
 * TASK SERVICE - Complete CRUD API
 * ============================================================
 *
 * Architecture: Clean Architecture + CQRS Pattern
 * - Queries: GetTaskByIdQuery, GetTasksQuery
 * - Commands: CreateTaskCommand, UpdateTaskDetailsCommand,
 *             ChangeTaskStatusCommand, AssignTaskCommand,
 *             DeleteTaskCommand
 */

/**
 * 1. CREATE Task
 * POST /v1/tasks
 *
 * Request:
 * {
 *   "title": "string (required)",
 *   "description": "string (optional)",
 *   "workspaceId": "string (required - MongoDB ID)"
 * }
 *
 * Response:
 * {
 *   "statusCode": 201,
 *   "data": {
 *     "success": true,
 *     "message": "Tạo công việc thành công",
 *     "data": {
 *       "taskId": "uuid-string"
 *     }
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * 2. READ All Tasks with Filters
 * GET /v1/tasks?workspaceId=xxx&status=TODO&assigneeId=yyy
 *
 * Query Parameters:
 * - workspaceId (required): Workspace ID
 * - status (optional): TODO | DOING | DONE
 * - assigneeId (optional): Filter by assignee
 *
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": {
 *     "tasks": [
 *       {
 *         "id": "uuid",
 *         "title": "string",
 *         "description": "string",
 *         "status": "TODO|DOING|DONE",
 *         "workspaceId": "string",
 *         "assigneeId": "string|null",
 *         "createdBy": {
 *           "userId": "string",
 *           "name": "string",
 *           "avatarUrl": "string|null"
 *         },
 *         "assignedTo": {
 *           "userId": "string",
 *           "name": "string",
 *           "avatarUrl": "string|null"
 *         } | null,
 *         "createdAt": "ISO-8601",
 *         "updatedAt": "ISO-8601"
 *       }
 *     ],
 *     "total": "number"
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * 3. READ Single Task by ID
 * GET /v1/tasks/:id
 *
 * Path Parameters:
 * - id (required): UUID of task
 *
 * Response: Same as individual task object from list
 */

/**
 * 4. UPDATE Task Details (Title, Description)
 * PATCH /v1/tasks/:id/details
 *
 * Request:
 * {
 *   "title": "string (required)",
 *   "description": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": {
 *     "message": "Cập nhật thông tin công việc thành công"
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * 5. CHANGE Task Status (Intent-based Update)
 * PATCH /v1/tasks/:id/status
 *
 * Request:
 * {
 *   "status": "TODO | DOING | DONE" (required)
 * }
 *
 * Business Rules:
 * - Can transition from TODO → DOING → DONE
 * - CANNOT go back from DONE to TODO
 *
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": {
 *     "message": "Đổi trạng thái công việc thành công"
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * 6. ASSIGN Task to User (Intent-based Update)
 * PATCH /v1/tasks/:id/assignee
 *
 * Request (Assign):
 * {
 *   "assigneeId": "string (user UUID)",
 *   "assigneeName": "string (required when assigning)",
 *   "assigneeAvatarUrl": "string (optional)"
 * }
 *
 * Request (Unassign):
 * {
 *   "assigneeId": null
 * }
 *
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": {
 *     "message": "Gán người phụ trách thành công"
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * 7. DELETE Task
 * DELETE /v1/tasks/:id
 *
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": {
 *     "message": "Xóa công việc thành công"
 *   },
 *   "requestId": "x-request-id"
 * }
 */

/**
 * ============================================================
 * KEY FEATURES
 * ============================================================
 *
 * ✅ Full CRUD Operations
 * ✅ Intent-based Updates (Status, Assignee separate endpoints)
 * ✅ Business Rule Validation (e.g., status transitions)
 * ✅ Clean Architecture Layers:
 *    - Presentation: Controller + DTOs
 *    - Application: Commands/Queries + Handlers
 *    - Domain: Entities + Value Objects + Business Rules
 *    - Infrastructure: Repository + Mapper + DB Schema
 * ✅ CQRS Pattern: Separate read (Query) and write (Command) paths
 * ✅ Type Safety: Strong typing with TypeScript + class-validator
 * ✅ Error Handling: Domain exceptions + Entity not found
 * ✅ Filtering: Status and Assignee filters on list endpoint
 */

/**
 * ============================================================
 * IMPLEMENTATION STRUCTURE
 * ============================================================
 *
 * Domain Layer:
 * - Task Entity: Aggregate root with business logic
 * - TaskId, TaskStatus, UserSnapshot: Value Objects
 * - Exceptions: BusinessRuleException, EntityNotFoundException
 *
 * Application Layer:
 * - Commands: CreateTaskCommand, UpdateTaskDetailsCommand, etc.
 * - Queries: GetTaskByIdQuery, GetTasksQuery
 * - Handlers: Implement ICommandHandler/IQueryHandler
 * - Ports: ITaskRepository interface
 *
 * Infrastructure Layer:
 * - MongoTaskRepository: Implements ITaskRepository
 * - TaskMapper: Converts Domain ↔ Persistence models
 * - TaskPersistence: MongoDB Schema
 *
 * Presentation Layer:
 * - TaskController: All endpoints
 * - DTOs: Request/Response data transfer objects
 * - ResponseWrapper: Consistent API response format
 */
