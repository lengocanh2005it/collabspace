# CollabSpace MVP Roadmap

## MVP Demo Goal

Deliver a short but complete collaboration demo:

1. User A registers.
2. User A verifies email with OTP.
3. User A logs in.
4. User A creates a workspace.
5. User A invites User B.
6. User A creates a project/board.
7. User A creates tasks.
8. User A assigns a task to User B.
9. User B logs in and moves task from `todo` to `in_progress`.
10. User A comments and mentions `@user-b`.
11. User B sees notification/activity.

## Current Status

Done:

- Auth registration.
- Email verification OTP.
- OTP resend with cooldown/max attempts.
- Login.
- Refresh token.
- Logout.
- Current user lookup.
- Access token verification.
- Change password.
- User profile creation from auth registration.
- Current user profile read/update.
- User summary.
- User list/search.
- Bulk user profile hydration.
- Username support for mention flows.

Removed/deprioritized for MVP:

- Public password reset flow.
- Advanced session management APIs.
- Public role/permission admin APIs.
- User preferences endpoints.
- Presence/status endpoints.
- Realtime WebSocket notifications.
- File upload/attachment.
- Sprint/epic/backlog planning.
- Custom workflow automation.
- Audit log/reporting/time tracking.

Pending:

- Workspace CRUD.
- Workspace invitations.
- Membership listing.
- Workspace roles.
- Project CRUD.
- Board view.
- Task CRUD.
- Assignment.
- Status/priority/due date updates.
- Comments.
- Mention parsing/resolution.
- Activity log.
- Notification persistence.
- Notification list/read API.

## Recommended Build Order

### Phase 1: Stabilize Auth/User Demo Base

Goal:

- Make sure the existing done areas are easy to run and demo.

Tasks:

- Replace starter service READMEs with project-specific docs.
- Verify migration and seed scripts from a clean DB.
- Verify auth register -> verify -> login -> me.
- Verify user profile update/list/search/bulk.
- Add any missing tests around current behavior before expanding.

Acceptance:

- New developer can start DB, run migrations, seed, and hit auth/user endpoints.

### Phase 2: Workspace MVP

Goal:

- Users can create workspaces and invite members.

Minimum features:

- Create workspace.
- List current user's workspaces.
- Get workspace detail.
- Update workspace.
- Invite user by user id or email.
- Accept invitation.
- List workspace members.
- Workspace roles: owner/admin/member.

Suggested implementation:

- Use PostgreSQL.
- Model `workspaces`, `workspace_members`, `workspace_invitations`.
- Use auth-service token verification for current user.
- Use user-service for invited user/profile hydration.
- Publish `WORKSPACE_INVITED` after invitation persistence.

Acceptance:

- User A creates workspace.
- User A invites User B.
- User B accepts invitation.
- Both users see membership correctly.

### Phase 3: Project and Board MVP

Goal:

- Workspace contains a project with a simple Kanban board.

Minimum features:

- Create project.
- List projects by workspace.
- Update project.
- Soft delete project.
- Get board grouped by task status.

Suggested implementation:

- If task-service owns project/board, project documents can live in MongoDB.
- Each project must include `workspaceId`.
- Check workspace membership before project read/write.

Acceptance:

- User A creates project inside workspace.
- Board endpoint returns empty columns: `todo`, `in_progress`, `done`.

### Phase 4: Task MVP

Goal:

- Users can create, assign, update, and view tasks.

Minimum features:

- Create task.
- List/filter/search tasks.
- Get task detail.
- Update title/description/status/priority/dueDate/assignee.
- Soft delete task.
- Publish `TASK_ASSIGNED` when assignee changes to a user.

Rules:

- Validate assignee exists through user-service.
- Check actor is workspace member.
- Preserve activity when status or assignee changes.

Acceptance:

- User A creates 3 tasks.
- User A assigns one task to User B.
- User B sees assigned task and moves it to `in_progress`.

### Phase 5: Comments, Mentions, Activity

Goal:

- Task collaboration is visible.

Minimum features:

- Add comment.
- List task comments.
- Parse `@username`.
- Resolve usernames through user-service search/profile APIs.
- Store activity entries for task create, assign, status change, comment.
- Publish `COMMENT_CREATED` with mentioned user ids.

Acceptance:

- User A comments `@user-b please check this`.
- User B is included in mentioned users.
- Activity shows the comment.

### Phase 6: Notification MVP

Goal:

- User can see relevant notification list.

Minimum features:

- Consume `WORKSPACE_INVITED`, `TASK_ASSIGNED`, `COMMENT_CREATED`.
- Persist notifications.
- `GET /notifications` for current user.
- Optional mark read.

Acceptance:

- User B sees notification for workspace invite.
- User B sees notification for assigned task.
- User B sees notification for mention.

## Demo Acceptance Checklist

- Auth:
  - Register returns pending verification.
  - OTP verification succeeds.
  - Login returns access and refresh token.
  - `/me` returns current user and profile identity.
- User directory:
  - User B can be found by username/display name.
  - Bulk hydration returns profiles for task/member UI.
- Workspace:
  - Workspace can be created.
  - Member can be invited and accepted.
  - Member list includes User A and User B.
- Project/board:
  - Project can be created in workspace.
  - Board returns grouped tasks.
- Task:
  - Task can be created.
  - Assignee can be set.
  - Status can move from `todo` to `in_progress`.
- Comment:
  - Comment can be added.
  - Mentioned username resolves to user id.
  - Comment appears in task detail/list.
- Notification:
  - Invite/assignment/mention notifications are persisted.
  - User B can list their notifications.

## Good First Implementation Slice

If the user asks "continue MVP" without specifying service, start with workspace-service because it unlocks authorization boundaries for project/task work.

Suggested first slice:

1. Implement workspace database schema.
2. Implement auth verification client.
3. Implement create workspace.
4. Implement list my workspaces.
5. Add tests.
6. Update docs.

Why:

- It creates the ownership/membership primitive needed by task/project/notification.
- It is easier to demo than starting with notification infrastructure.

