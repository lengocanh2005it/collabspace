# Backup & recovery policy

CollabSpace demo/staging baseline for PostgreSQL (auth, user, workspace) and MongoDB (task, notification).

## Targets

| Store | Services | RPO (max data loss) | RTO (max downtime) | Method |
|-------|----------|---------------------|--------------------|--------|
| PostgreSQL | auth, user, workspace | 24h (daily backup) | 4h | Logical dump (`pg_dump`) |
| MongoDB | task, notification | 24h (daily backup) | 4h | `mongodump` archive |
| Redis | auth, notification | None required | Recreate empty | OTP/cache only; not backed up |
| RabbitMQ | all publishers | None required | Re-declare from `definitions.json` | Messages are transient; outboxes replay |

Production should tighten RPO to **1h** (hourly dumps + WAL archiving for Postgres) once traffic warrants it.

## What to back up

- **PostgreSQL databases:** `collabspace_auth`, `collabspace_user`, `collabspace_workspace`
- **MongoDB databases:** `collabspace_task`, `collabspace_notification` (names from service `.env.example`)
- **Not in scope:** application containers, Traefik config (Git), RabbitMQ queues (rebuilt from outbox + events)

## Local / Docker Compose

Example scripts: `infrastructure/backup/scripts/`.

```sh
# From repo root, with stack running (docker-compose.db.yml)
./infrastructure/backup/scripts/backup-postgres.sh
./infrastructure/backup/scripts/backup-mongo.sh
```

Artifacts land in `infrastructure/backup/artifacts/` (gitignored). Rotate locally; copy to object storage in staging/prod.

## Kubernetes / Helm

1. Use managed databases (RDS, Cloud SQL, Atlas) with provider-native automated backups and point-in-time recovery when available.
2. Do **not** rely on pod ephemeral storage for data.
3. Store backup credentials in External Secrets / sealed secrets — never in `values.yaml` plaintext.
4. Schedule CronJobs or use the cloud provider backup window; document owner and on-call escalation in `docs/runbooks/`.

## Restore drill (quarterly)

1. Restore latest Postgres dump into a **fresh** database instance; run migrations if schema drifted.
2. Restore Mongo archive into a test cluster; verify task/notification read APIs.
3. Record elapsed time vs RTO; file gaps in this doc.

**Hiện trạng repo:** có `backup-postgres.sh` / `backup-mongo.sh` (chạy tay, Docker); **chưa có** `restore-*.sh`, CronJob, offsite copy, runbook restore chi tiết — xem [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) mục 14–15.

## Related

- Production checklist: `docs/production-hardening.md`
- Infra backlog (backup automation): `docs/team/phan-phu-tho-infrastructure-backlog.md`
- Resilience drills: `infrastructure/resilience/drills/README.md`
