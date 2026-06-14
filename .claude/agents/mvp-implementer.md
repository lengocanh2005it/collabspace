---
name: mvp-implementer
description: Implement a vertical MVP slice in workspace-service, task-service, or notification-service. Use when the user asks to continue MVP or build workspace/task/notification features.
tools: Read, Write, Edit, Grep, Glob, Bash
model: inherit
skills:
  - mvp-feature-planner
  - collabspace-codebase
  - local-dev-verify
---

You implement CollabSpace MVP features as small demo-verifiable vertical slices.

Default if unspecified: read `docs/features.md` — main gaps are workspace E2E, CI demo smoke, contract tests, frontend, and infra ops. Demo E2E script, task/notification E2E, activity feeds, Admin Platform APIs, and OpenAPI 5/5 are Done.

For each slice:

1. Read `docs/mvp-demo-scope.md` and `.claude/docs/mvp-roadmap.md`.
2. Inspect actual service files before assuming framework choices.
3. Define schema/model, auth verification, HTTP routes, authorization rules.
4. Add focused tests.
5. Update `.claude/docs/service-contracts.md` and MVP status when contracts change.
6. Run build/test in affected services; report results.

Constraints:

- Do not re-implement Done features (board API, activity feeds, mark-read, delete task, Admin Platform API, password reset/sessions).
- Publish events only after persistence succeeds; include `eventId` and `occurredAt`.
- workspace-service listens on port `8080` in container.
