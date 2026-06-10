# PostgresDown

**Alert:** `pg_up == 0` for 1 minute  
**Severity:** critical

## Affected services

- auth-service (`collabspace_auth`)
- user-service (`collabspace_user`)
- workspace-service (`collabspace_workspace`)

## Symptoms

- `/health/ready` returns **503** with `postgres: down` or `unavailable`.
- Auth login/register and workspace mutations fail.

## Diagnosis

```sh
docker ps --filter name=postgres
docker logs collabspace-postgres --tail 50
```

## Remediation

1. Start Postgres: `docker compose -f infrastructure/docker/docker-compose.db.yml up -d postgres`
2. Wait for `pg_isready`, then restart app services that cache connections.
3. Verify readiness endpoints return 200.
4. Check disk space and connection limits if Postgres exits repeatedly.
