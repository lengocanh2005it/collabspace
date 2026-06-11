---
name: mvp-feature-planner
description: Plan or implement the next CollabSpace MVP feature across workspace, project, task, comment, activity, and notification services. Use when the user asks what remains, asks to continue MVP, or requests workspace/task/notification features.
---

# MVP Feature Planner Skill

Use this skill to slice pending MVP work into safe, demo-oriented increments.

## Required Context

Read:

- `docs/features.md`
- `docs/mvp-demo-scope.md`
- `.claude/docs/mvp-roadmap.md`
- `.claude/docs/project-architecture.md`
- `.claude/docs/service-contracts.md`

## Default Priority

If the user says "continue MVP" without a target, read `docs/features.md` for **Planned** / **Partial** items first. Typical gaps (2026-06 sync):

1. **E2E + CI** — `scripts/demo-e2e` Done; gắn CI + `*.e2e-spec.ts` workspace/task/notification.
2. **Workspace activity feed** — task-level `GET /tasks/:id/activity` Done.
3. **OpenAPI / contract test** — workspace + notification Swagger; Pact/schema (backlog).
4. **Frontend UI** — out of scope repo; backend APIs largely Done.

Do **not** re-implement: board API, task delete, mark-read, Phase B/C platform work — see `docs/features.md`.

## Planning Rules

- Always identify the smallest demo-verifiable slice.
- Prefer vertical slices over large infrastructure-only rewrites.
- Include data model, API route, auth rule, event impact, tests, and docs.
- Keep cross-service contracts explicit.
- If a target service is only scaffolded, first inspect its actual files before choosing framework details.

## Workspace Slice Template

Goal:

- Add workspace membership primitive.

Implementation checklist:

1. Define workspace/member/invitation schema.
2. Add auth verification integration.
3. Add create workspace.
4. Add list my workspaces.
5. Add invite member.
6. Add accept invitation.
7. Add list members.
8. Publish `WORKSPACE_INVITED`.
9. Add unit/e2e tests.
10. Update README and `.claude/docs`.

## Task Slice Template

Goal:

- Add project board and task workflow.

Implementation checklist:

1. Define project/task/comment/activity models.
2. Add auth verification integration.
3. Add workspace membership checks.
4. Add project CRUD.
5. Add board endpoint grouped by status.
6. Add task CRUD.
7. Add assignment and status updates.
8. Publish `TASK_ASSIGNED`.
9. Add tests and docs.

## Comment/Mention Slice Template

Goal:

- Support collaboration on tasks.

Implementation checklist:

1. Add comment model.
2. Parse `@username` mentions.
3. Resolve usernames through user-service.
4. Persist mentioned user ids.
5. Add activity entry.
6. Publish `COMMENT_CREATED`.
7. Add tests for parsing, resolution, duplicate mentions, and no-mention comments.

## Notification Slice Template

Goal:

- Persist and list notifications.

Implementation checklist:

1. Define notification model.
2. Consume workspace/task/comment events.
3. Dedupe by `eventId`.
4. Add `GET /notifications`.
5. Add mark-read endpoint if requested.
6. Verify notifications are scoped to current authenticated user.

## Output Rules

When planning:

- Give a compact sequence with acceptance criteria.
- Call out dependencies on other services.
- Do not overbuild features marked out of scope.

When implementing:

- Implement the first coherent slice end to end.
- Update **tests, agent docs, human docs, and skills** in the same change when the slice changes contracts or MVP status:
  - `docs/features.md`, `docs/mvp-demo-scope.md`, `.claude/docs/mvp-roadmap.md`
  - `.claude/docs/service-contracts.md`, `docs/api-routes.md`
  - `docs/team/application-backlog.md` if closing a backlog item
  - This skill or `nest-service-change` / `local-dev-verify` if workflow steps changed
- See `.claude/rules/docs-and-skills-sync.md`.

