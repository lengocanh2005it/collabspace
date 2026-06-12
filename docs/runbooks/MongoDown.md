# MongoDown

**Cảnh báo:** `up{job="mongodb"} == 0`  
**Mức độ:** critical  
**Bị ảnh hưởng:** task-service, notification-service

## Khắc phục

1. `docker compose -f infrastructure/docker/docker-compose.db.yml up -d mongodb` hoặc restart StatefulSet Mongo trên K8s.
2. Restart task-service và notification-service.
3. Verify `/api/v1/tasks/health/ready` và `/api/v1/notifications/health/ready`.

## Mất dữ liệu / volume hỏng

Restore từ artifact `infrastructure/backup/scripts/backup-mongo.sh` — xem `docs/backup-policy.md`.
