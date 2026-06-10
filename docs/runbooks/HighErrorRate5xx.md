# HighErrorRate5xx

**Alert:** 5xx rate > 5% over 5 minutes  
**Severity:** warning

## Symptoms

- Elevated `http_requests_total{status=~"5.."}` in Prometheus.
- Users see intermittent server errors.

## Diagnosis

1. Identify the job label (`auth-service`, `task-service`, etc.) in the alert.
2. Check recent deploys and dependency outages (`/health/ready` on the affected service).
3. Review service logs for stack traces around the alert window.
4. For task-service, check `WORKSPACE_SERVICE_UNAVAILABLE` when workspace is down.

## Remediation

1. Roll back the last deployment if errors started after a release.
2. Restore failed dependencies (see PostgresDown, MongoDown, RabbitMQ runbooks).
3. Scale replicas if overload is suspected (K8s HPA or manual replica bump).
4. Confirm error rate normalizes in Grafana/Prometheus within 10 minutes.
