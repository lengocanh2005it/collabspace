# PostgresDown

**Cảnh báo:** `pg_up == 0` trong 1 phút  
**Mức độ:** critical

## Service bị ảnh hưởng

- auth-service (`collabspace_auth`)
- user-service (`collabspace_user`)
- workspace-service (`collabspace_workspace`)

## Triệu chứng

- `/health/ready` trả **503** với `postgres: down` hoặc `unavailable`.
- Login/register và mutation workspace fail.

## Chẩn đoán

```sh
docker ps --filter name=postgres
docker logs collabspace-postgres --tail 50
# Kubernetes:
kubectl -n collabspace get pods -l app.kubernetes.io/name=postgresql
kubectl -n collabspace logs statefulset/postgres --tail 50
```

## Khắc phục

1. Khởi động Postgres: `docker compose -f infrastructure/docker/docker-compose.db.yml up -d postgres` hoặc scale StatefulSet Bitnami.
2. Đợi `pg_isready`, restart app service cache connection.
3. Verify readiness endpoint trả 200.
4. Kiểm tra disk và connection limit nếu Postgres thoát liên tục.

## Mất dữ liệu / volume hỏng

Restore từ backup — xem `docs/backup-policy.md` và `infrastructure/backup/scripts/`. Backlog: backup tự động + restore drill trong `docs/team/phan-phu-tho-infrastructure-backlog.md`.
