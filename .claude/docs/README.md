# Claude Code Docs For CollabSpace

This directory contains detailed project context for Claude Code. Keep `CLAUDE.md` concise and place detailed, occasionally needed guidance here.

## Files

- `project-architecture.md`: system map, service ownership, infrastructure, data stores, and communication patterns.
- `service-contracts.md`: public HTTP routes, internal gRPC contracts, event contracts, auth headers, and integration rules.
- `development-workflows.md`: setup, Docker Compose flows, migrations, seeding, testing, observability, and troubleshooting.
- `coding-conventions.md`: NestJS, TypeORM, DTO, repository, error, config, migration, and test conventions.
- `mvp-roadmap.md`: current implementation status, demo story, gap analysis, and recommended implementation order.

## Maintenance Rules

- Update these docs when service boundaries, ports, routes, environment variables, migrations, or MVP status change.
- Keep `CLAUDE.md` under roughly 200 lines. Move long procedures into skills or these docs.
- Prefer precise file paths and concrete commands over general advice.
- If a doc conflicts with code, trust code first and update the doc.

