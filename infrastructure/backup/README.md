# Backup & Restore

Backup tự động PostgreSQL + MongoDB sang DO Spaces; restore bằng một lệnh.

## Cấu trúc

```
infrastructure/backup/
  scripts/
    backup-postgres.sh        # dump PG thủ công (local Docker)
    backup-mongo.sh           # dump Mongo thủ công (local Docker)
    restore-postgres.sh       # restore PG từ artifact dir local
    restore-mongo.sh          # restore Mongo từ artifact dir local
    restore-from-spaces.sh    # download snapshot từ DO Spaces rồi restore
    restore-prod.sh           # wrapper: auto-load credentials rồi gọi restore-from-spaces.sh
  artifacts/                  # gitignored — dump local lưu ở đây
```

## Prod — DO Spaces (tự động)

Helm CronJob chạy mỗi ngày trên Droplet k3s:

| Job | Schedule (UTC) | Destination |
|-----|----------------|-------------|
| `backup-postgres` | 02:00 | `s3://collabspace-bucket/backups/postgres/YYYYMMDD/STAMP/` |
| `backup-mongo` | 02:30 | `s3://collabspace-bucket/backups/mongo/YYYYMMDD/STAMP/` |

Retention: 7 ngày. Credentials inject qua Vault ESO → K8s secret `backup-spaces-secret`.

Bật/tắt: `backup.enabled` trong `values-prod.yaml` (hiện `true`).

## Restore từ DO Spaces

```sh
# Trên Droplet — tự lấy credentials từ K8s secret
./infrastructure/backup/scripts/restore-prod.sh
# → in ra danh sách snapshots có sẵn

./infrastructure/backup/scripts/restore-prod.sh 20260620/20260620T020000Z
# → download + restore

# Local với Vault
VAULT_ADDR=http://localhost:8200 VAULT_TOKEN=xxx \
  ./infrastructure/backup/scripts/restore-prod.sh 20260620/20260620T020000Z

# Local với key trực tiếp
DO_SPACES_KEY=xxx DO_SPACES_SECRET=yyy \
  ./infrastructure/backup/scripts/restore-prod.sh 20260620/20260620T020000Z
```

`restore-prod.sh` tự resolve credentials theo thứ tự:
1. `DO_SPACES_KEY` / `DO_SPACES_SECRET` có sẵn trong env
2. Vault CLI (`VAULT_ADDR` + `VAULT_TOKEN`)
3. `kubectl` → K8s secret `backup-spaces-secret` (namespace `collabspace`)

## Sau khi restore

```sh
# 1. Chạy migration nếu schema lệch
pnpm --filter auth-service      run migrate
pnpm --filter user-service      run migrate
pnpm --filter workspace-service run migrate

# 2. Restart app services
docker compose -f infrastructure/docker/docker-compose.yml \
               -f infrastructure/docker/docker-compose.db.yml \
               -f infrastructure/docker/docker-compose.override.yml \
               restart auth-service user-service workspace-service task-service notification-service

# 3. Verify
./infrastructure/resilience/drills/verify-readiness.sh
```

## Backup thủ công (local Docker)

```sh
# Yêu cầu: stack đang chạy (docker-compose.db.yml)
./infrastructure/backup/scripts/backup-postgres.sh
./infrastructure/backup/scripts/backup-mongo.sh
# artifact lưu ở infrastructure/backup/artifacts/<stamp>/
```

## Automated restore drill (CI)

Workflow `.github/workflows/restore-drill.yml` chạy mỗi thứ Hai 4AM UTC:

1. Tạo namespace `collabspace-restore-drill` trên DOKS
2. Spin up temp `postgres:17-alpine` + `mongo:6` pods
3. Resolve stamp mới nhất từ DO Spaces (tự skip PG dump < 1KB)
4. Restore PG (3 DBs) + Mongo
5. Verify row/collection counts
6. Xóa namespace

Trigger thủ công: **Actions → Restore Drill → Run workflow** (có thể chỉ định stamp cụ thể).

Secrets cần: `KUBECONFIG_DOKS`, `DO_SPACES_KEY`, `DO_SPACES_SECRET` (đã có trong GitHub repo secrets).

## Tài liệu liên quan

- Chính sách: [`docs/backup-policy.md`](../../docs/backup-policy.md)
- Drill log: [`infrastructure/resilience/drills/README.md`](../resilience/drills/README.md)
- Vault secret: `kv/backup-spaces-secret` (keys: `doSpacesKey`, `doSpacesSecret`, `postgresPassword`, `mongoPassword`)
- Helm CronJob: [`infrastructure/helm/collabspace/templates/jobs/backup-cronjob.yaml`](../helm/collabspace/templates/jobs/backup-cronjob.yaml)
