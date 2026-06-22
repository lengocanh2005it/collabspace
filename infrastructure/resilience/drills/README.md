# Resilience drills

Scripts to verify readiness and run quarterly failure drills on the local Docker stack.

## Prerequisites

1. Docker Desktop / daemon running.
2. Stack up:

```sh
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

3. Wait until migrations and healthchecks pass (~2–3 min on cold start).

---

## Drill 1 — Readiness verify (`verify-readiness.sh`)

Polls `GET .../health/ready` on all five app services (host ports 3000–3004). Exits non-zero if any endpoint is not `200`.

```sh
./infrastructure/resilience/drills/verify-readiness.sh
```

Expected when healthy:

```
[OK]   auth (200) http://localhost:3000/api/v1/auth/health/ready
[OK]   user (200) ...
...
All services report ready.
```

---

## Drill 2 — Restore drill (quarterly, #19)

Verifies that a backup produced by `backup-postgres.sh` / `backup-mongo.sh` can be restored into a fresh container and that service APIs come back healthy.

### Steps

```sh
# 1. Produce a backup from the running stack
./infrastructure/backup/scripts/backup-postgres.sh
./infrastructure/backup/scripts/backup-mongo.sh
# Note the artifact directory printed (e.g. infrastructure/backup/artifacts/20260619T120000Z)

# 2. Restore (can be done against the same stack or a separate container)
ARTIFACT=infrastructure/backup/artifacts/<snapshot-dir>
./infrastructure/backup/scripts/restore-postgres.sh "$ARTIFACT"
./infrastructure/backup/scripts/restore-mongo.sh    "$ARTIFACT"

# 3. Run migrations if needed (restore-postgres.sh prints the commands)
pnpm --filter auth-service      run migrate
pnpm --filter user-service      run migrate
pnpm --filter workspace-service run migrate

# 4. Restart app services so they reconnect to the restored DBs
docker compose -f infrastructure/docker/docker-compose.yml \
               -f infrastructure/docker/docker-compose.db.yml \
               -f infrastructure/docker/docker-compose.override.yml \
               restart auth-service user-service workspace-service task-service notification-service

# 5. Smoke verify
./infrastructure/resilience/drills/verify-readiness.sh
```

### Pass criteria

| Check | Expected |
|-------|----------|
| `restore-postgres.sh` exits 0 | All 3 Postgres DBs restored |
| `restore-mongo.sh` exits 0 | Mongo archive restored |
| `verify-readiness.sh` exits 0 | All 5 services healthy |
| Elapsed time | ≤ RTO 4h (target: < 30 min for local Docker drill) |

---

## Drill 3 — Chaos drill (quarterly, #23)

Stops one app container, confirms readiness fails, restarts, confirms recovery within RTO.

```sh
# Run against each of the 5 app services (one at a time)
./infrastructure/chaos/chaos-stop-service.sh auth-service
./infrastructure/chaos/chaos-stop-service.sh user-service
./infrastructure/chaos/chaos-stop-service.sh workspace-service
./infrastructure/chaos/chaos-stop-service.sh task-service
./infrastructure/chaos/chaos-stop-service.sh notification-service
```

The script: stops container → runs `verify-readiness.sh` (expected failures) → starts container → runs `verify-readiness.sh` (must pass).

### Pass criteria

| Check | Expected |
|-------|----------|
| `verify-readiness.sh` after stop | Stopped service shows non-200 (other services remain 200) |
| `verify-readiness.sh` after restart | All 5 services return 200 |
| Recovery time per service | ≤ 30 s (container restart) |

> **Safety:** run only on local/dev environments. Never on production without a change window.  
> Runbooks per service: `docs/runbooks/`.

---

## Drill log

> Cập nhật bảng này sau mỗi lần chạy drill. Giữ 12 tháng gần nhất.

### Restore drill log

| Ngày | Người chạy | Artifact | PG restore | Mongo restore | verify-readiness | Thời gian thực tế | Ghi chú |
|------|-----------|----------|------------|---------------|-----------------|-------------------|---------|
| 2026-06-10 | Phan Phú Thọ | — | Skipped | Skipped | Skipped | — | Docker daemon offline (`dockerDesktopLinuxEngine` pipe missing) |
| 2026-06-20 | Lê Ngọc Anh | local Docker stack | ✅ Pass | ✅ Pass | ✅ All 5 OK | ~8 min | 3 PG DBs + Mongo (558 docs, 11 collections) restored; services restart clean; backup offsite DO Spaces CronJob bật prod (`values-prod.yaml backup.enabled: true`) |
| 2026-06-22 | Lê Ngọc Anh | DO Spaces DOKS drill (temp namespace `collabspace-restore-drill`) | ✅ Pass | ✅ Pass | N/A (isolated namespace, no app pods) | ~15 min | **First DO Spaces restore drill on DOKS.** PG: `20260621T020023Z` (auth ~269 rows, user ~131, workspace ~241). Mongo: `20260622T023031Z` (497 docs, 11 collections). PG backup `20260622T020020Z` skipped — 20 bytes (empty, CNPG migration đang diễn ra). Warnings: `transaction_timeout` unknown param (PG16 temp pod vs PG17 prod) + `wal_level` (không ảnh hưởng restore). Namespace xóa sạch sau drill. |

### Chaos drill log

| Ngày | Người chạy | Service bị chaos | verify sau stop | verify sau restart | Recovery time | Ghi chú |
|------|-----------|-----------------|-----------------|-------------------|---------------|---------|
| 2026-06-10 | Phan Phú Thọ | — | Skipped | Skipped | — | Docker daemon offline; re-run khi daemon lên |

---

## Automated restore drill (CI)

Restore drill chạy tự động mỗi thứ Hai qua `.github/workflows/restore-drill.yml` — không cần chạy tay quarterly nữa. Kết quả xem trong GitHub Actions tab.

Trigger thủ công nếu muốn test ngay: **Actions → Restore Drill → Run workflow**.

## Staging / production

- Run `verify-readiness.sh` after every deploy (CI smoke job).
- Run chaos drill quarterly on **staging only**; never on production without a change window.
- Run restore drill quarterly; log actual elapsed time vs RTO 4h in the tables above.
- Tie alert responses to `docs/runbooks/` entries.
- Runbook rotation secrets: `docs/runbooks/SecretRotation.md`.
