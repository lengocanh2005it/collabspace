---
name: collabspace-codebase
description: Understand the CollabSpace repository, architecture, service ownership, current MVP status, and where to make changes. Use when starting work, answering architecture questions, onboarding, or deciding which service owns a feature.
---

# CollabSpace Codebase Skill

Use this skill to orient yourself before making project-wide or service-boundary decisions.

## Required Context

Read these files as needed:

- `README.md`
- `docs/mvp-demo-scope.md`
- `.claude/docs/project-architecture.md`
- `.claude/docs/service-contracts.md`
- `.claude/docs/mvp-roadmap.md`

## Orientation Steps

1. Identify the user request category:
   - auth/identity
   - user profile/directory
   - workspace/membership/invite
   - project/board/task/comment
   - notification/activity
   - infrastructure/observability/CI
2. Map the request to the owning service.
3. Check whether the target service is implemented or still scaffold-level.
4. Read the target service's README, `package.json`, `src/app.module.ts`, controllers, services/use cases, entities, repositories, migrations, and tests.
5. Summarize the current state before proposing cross-service work.

## Service Ownership

- Auth credentials, roles, permissions, sessions, JWT, OTP: `services/auth-service`.
- User profiles, usernames, display names, user search, profile hydration: `services/user-service`.
- Workspace CRUD, membership, invitations, workspace roles: `services/workspace-service`.
- Projects, boards, tasks, comments, mentions, activity: `services/task-service`.
- Notification persistence, notification list/read API, event consumption: `services/notification-service`.
- Gateway routing: `api-gateway`.
- Compose/K8s/observability/CI: `infrastructure`.

## Output Style

When answering architecture questions:

- Start with the direct answer.
- Mention the exact service/path.
- Call out whether the feature is done, partial, or pending.
- Include the smallest next step if implementation is requested.

When implementing:

- Do not stop at a high-level plan if the request asks for code.
- Keep edits scoped to the owning service unless integration files must change.
- Update docs if contracts, ports, env vars, or MVP status changed.

