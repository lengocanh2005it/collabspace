# Chaos drills (Phase 4)

Lightweight failure injection for local Docker stacks. These scripts are **not** for production clusters.

## Prerequisites

- Full stack running via `infrastructure/docker/docker-compose.yml` + `docker-compose.db.yml`.
- Host mapped ports: auth `3000`, user `3001`, workspace `3002`, task `3003`, notification `3004`.

## Scripts

| Script | Action |
|--------|--------|
| `chaos-stop-service.sh` | Stop one app container, verify readiness fails, restart |
| `chaos-network-delay.md` | Manual toxiproxy / `tc` notes for latency injection |

## Usage

```sh
./infrastructure/chaos/chaos-stop-service.sh auth-service
./infrastructure/resilience/drills/verify-readiness.sh
```

## Safety

- Run only on local/dev environments.
- Never run `docker kill` on production databases.
- Pair chaos runs with runbooks in `docs/runbooks/`.
