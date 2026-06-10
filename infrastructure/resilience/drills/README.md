# Resilience drills

Scripts to verify readiness and basic failure recovery on a local Docker stack.

## Prerequisites

1. Docker Desktop / daemon running.
2. Stack up:

```sh
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

3. Wait until migrations and healthchecks pass (~2–3 min on cold start).

## verify-readiness.sh

Polls `GET .../health/ready` on all five app services (host ports 3000–3004). Exits non-zero if any endpoint is not `200`.

```sh
./infrastructure/resilience/drills/verify-readiness.sh
```

Expected when healthy:

```
[OK]   auth (200) http://localhost:3000/api/v1/auth/health/ready
[OK]   user (200) ...
...
All services report ready.
```

## chaos-stop-service.sh

Stops one container, confirms readiness fails, restarts, confirms recovery.

```sh
./infrastructure/chaos/chaos-stop-service.sh auth-service
```

Use the **container name** from `docker ps` (compose project prefix may apply, e.g. `docker-auth-service-1`).

## Last run (2026-06-10)

| Drill | Result | Notes |
|-------|--------|-------|
| `verify-readiness.sh` | **Skipped** | Docker daemon not running (`dockerDesktopLinuxEngine` pipe missing). Client installed (29.x) but engine offline. |
| `chaos-stop-service.sh` | **Skipped** | Requires running stack + verify-readiness baseline. |

Re-run after `docker compose up -d` and update this table.

## Staging / production

- Run verify-readiness after deploy (CI or smoke job).
- Run chaos-stop quarterly on staging only; never on production without change window.
- Tie alerts to `docs/runbooks/` entries.
