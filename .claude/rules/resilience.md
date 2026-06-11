---
paths:
  - "services/**/integrations/**"
  - "services/**/health/**"
  - "services/**/outbox/**"
  - "services/**/messaging/**"
  - "api-gateway/**"
  - "infrastructure/rabbitmq/**"
---

# Resilience rules (auto-loaded for integration paths)

Read `.claude/docs/resilience.md` before editing.

Quick rules:

- gRPC/HTTP clients: explicit timeout; map failures to `503` + `*_UNAVAILABLE` or `*_TIMEOUT`.
- Events: `eventId` + `occurredAt`; consumers idempotent; publish after persistence.
- Health: update `/ready` when adding required dependencies.
- Update degradation matrix in `resilience.md` if user-visible failure behavior changes.
