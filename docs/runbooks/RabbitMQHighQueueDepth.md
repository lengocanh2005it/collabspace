# RabbitMQHighQueueDepth

**Alert:** `rabbitmq_queue_messages > 1000` for 5 minutes  
**Severity:** warning

## Symptoms

- Events lag (notifications delayed, outbox backlog).
- Consumer pods may be down or slow.

## Diagnosis

1. Open RabbitMQ management UI (port 15672) and inspect queue depth.
2. Check notification-service and auth/user consumers are running.
3. Review DLQ runbook if messages are poison.

## Remediation

1. Scale consumer services (notification-service replicas).
2. Fix crashing consumers (check logs).
3. After fixing root cause, drain backlog; monitor queue depth trending down.
4. For sustained load, tune `prefetchCount` and outbox poll interval.
