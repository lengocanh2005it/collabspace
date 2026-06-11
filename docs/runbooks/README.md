# CollabSpace Runbooks

Operational playbooks for Prometheus alerts defined in `infrastructure/monitoring/alert-rules.yml`.

| Alert | Severity | Runbook |
|-------|----------|---------|
| ServiceDown | critical | [ServiceDown.md](./ServiceDown.md) |
| ServiceHighRestartRate | warning | [ServiceHighRestartRate.md](./ServiceHighRestartRate.md) |
| HighErrorRate5xx | warning | [HighErrorRate5xx.md](./HighErrorRate5xx.md) |
| HighLatencyP99 | warning | [HighLatencyP99.md](./HighLatencyP99.md) |
| PostgresDown | critical | [PostgresDown.md](./PostgresDown.md) |
| RedisDown | critical | [RedisDown.md](./RedisDown.md) |
| MongoDown | critical | [MongoDown.md](./MongoDown.md) |
| RabbitMQHighQueueDepth | warning | [RabbitMQHighQueueDepth.md](./RabbitMQHighQueueDepth.md) |
| RabbitMQDLQNotEmpty | warning | [RabbitMQDLQNotEmpty.md](./RabbitMQDLQNotEmpty.md) |

## Quick checks

```sh
# Readiness (expect 200 when healthy, 503 when dependency missing)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/auth/health/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/users/health/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/v1/workspaces/health/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/v1/tasks/health/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/api/v1/notifications/health/ready
```

Automated drill: `infrastructure/resilience/drills/verify-readiness.ps1` (Windows) or `verify-readiness.sh` (Linux/macOS).
