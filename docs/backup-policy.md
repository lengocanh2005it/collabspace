# Chính sách backup & phục hồi

Baseline demo/staging cho PostgreSQL (auth, user, workspace) và MongoDB (task, notification).

## Mục tiêu

| Kho | Service | RPO (mất dữ liệu tối đa) | RTO (downtime tối đa) | Phương pháp |
|-----|---------|---------------------------|------------------------|-------------|
| PostgreSQL | auth, user, workspace | 24h (backup hàng ngày) | 4h | Logical dump (`pg_dump`) |
| MongoDB | task, notification | 24h (backup hàng ngày) | 4h | Archive `mongodump` |
| Redis | auth, notification | Không bắt buộc | Tạo lại rỗng | Chỉ OTP/cache; không backup |
| Kafka | mọi outbox publisher | Không bắt buộc | Replay từ WAL/oplog + outbox | Message tạm trên broker; outbox là source of truth |

Production nên siết RPO xuống **1 giờ** (dump hàng giờ + WAL archiving cho Postgres) khi traffic đủ lớn.

## Phạm vi backup

- **PostgreSQL:** `collabspace_auth`, `collabspace_user`, `collabspace_workspace`
- **MongoDB:** `collabspace_task`, `collabspace_notification` (tên từ `.env.example` service)
- **Không backup:** container app, cấu hình Traefik (có trong Git), Kafka topic retention (tái tạo từ outbox + CDC)

## Local / Docker Compose

Script mẫu: `infrastructure/backup/scripts/`.

```sh
# Từ repo root, stack đang chạy (docker-compose.db.yml)
./infrastructure/backup/scripts/backup-postgres.sh
./infrastructure/backup/scripts/backup-mongo.sh
```

Artifact lưu tại `infrastructure/backup/artifacts/` (gitignored). Xoay vòng local; copy lên object storage trên staging/prod.

## Kubernetes / Helm

1. Ưu tiên managed database (RDS, Cloud SQL, Atlas) với backup tự động và point-in-time recovery khi có.
2. **Không** dựa vào ephemeral storage của pod cho dữ liệu.
3. Lưu credential backup trong **HashiCorp Vault** (sync qua ESO) — không plaintext trong `values.yaml`. Xem `infrastructure/vault/README.md`.
4. Lên lịch CronJob hoặc dùng cửa sổ backup của cloud provider; ghi owner và escalation trong `docs/runbooks/`.

**k3s single-node:** bắt buộc CronJob backup DB + copy offsite (DO Spaces / S3) — xem [deployment-k3s-phases.md](./deployment-k3s-phases.md) Phase 5.

## Restore drill (hàng quý)

1. Restore dump Postgres mới nhất vào instance DB **mới**; chạy migration nếu schema lệch.
2. Restore archive Mongo vào cluster test; verify API đọc task/notification.
3. Ghi thời gian thực tế so với RTO; cập nhật gap vào tài liệu này.

**Hiện trạng repo:** có `backup-postgres.sh` / `backup-mongo.sh` (chạy tay, Docker); Helm CronJob `backup-postgres` / `backup-mongo` dump vào `/tmp` pod (chưa offsite). **Chưa có** `restore-*.sh`, restore drill log, copy artifact sang object storage — xem [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) mục 14–15.

## Tài liệu liên quan

- Checklist production: `docs/production-hardening.md`
- Backlog backup automation: `docs/team/phan-phu-tho-infrastructure-backlog.md`
- Drill resilience: `infrastructure/resilience/drills/README.md`
- Lộ trình deploy: `docs/deployment-k3s-phases.md`
