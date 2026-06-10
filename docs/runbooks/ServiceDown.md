# ServiceDown

**Alert:** `up == 0` for 1 minute  
**Severity:** critical

## Symptoms

- Prometheus cannot scrape `/metrics` or the process is not listening.
- Gateway returns `502/503` for routes owned by the service.
- Kubernetes readiness probe fails; pod removed from Service endpoints.

## Diagnosis

1. Check container/pod status: `docker ps` or `kubectl -n collabspace get pods -l app=<service>`.
2. Inspect logs: `docker logs <container>` or `kubectl logs deploy/<service>`.
3. Verify `/health/live` returns 200 (process up) vs `/health/ready` (dependencies OK).

## Remediation

1. Restart the service container or roll the deployment.
2. If crash-looping, fix the startup error (DB URL, missing env, migration failure).
3. Confirm dependency health (Postgres, Redis, Mongo, RabbitMQ) before declaring resolved.
4. Re-run `infrastructure/resilience/drills/verify-readiness.ps1`.

## Escalation

If multiple services are down simultaneously, check shared infrastructure (Docker network, Postgres, RabbitMQ) first.
