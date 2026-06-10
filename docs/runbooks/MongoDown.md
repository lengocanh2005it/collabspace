# MongoDown

**Alert:** `up{job="mongodb"} == 0`  
**Severity:** critical  
**Affected:** task-service, notification-service

## Remediation

1. `docker compose -f infrastructure/docker/docker-compose.db.yml up -d mongodb`
2. Restart task-service and notification-service.
3. Verify `/api/v1/tasks/health/ready` and `/api/v1/notifications/health/ready`.
