# Triển khai CollabSpace lên DigitalOcean Droplet (Docker Compose — legacy)

> **Lưu ý:** Đây là đường deploy **legacy** dùng Docker Compose + SSH.  
> **Production được khuyến nghị:** [deployment-k3s-phases.md](./deployment-k3s-phases.md) (k3s + Helm + Vault + ESO).  
> So sánh phương án: [digitalocean-production-options.md](./digitalocean-production-options.md).

Hướng dẫn này triển khai toàn bộ stack Compose lên **một Droplet**:

- Traefik gateway cổng `80` và `443`
- Năm service NestJS
- PostgreSQL, MongoDB, Redis, Kafka + Debezium Connect
- Image build bởi GitHub Actions và push lên GitHub Container Registry (GHCR)

**Droplet gợi ý:** Ubuntu 24.04 LTS, 4 vCPU, 8 GiB RAM, 160 GiB disk.

---

## 1. Bootstrap Droplet

SSH vào Droplet:

```sh
ssh root@<ip-droplet>
```

Chạy script bootstrap với URL repo Git:

```sh
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/infrastructure/deploy/doks-bootstrap.sh -o /tmp/doks-bootstrap.sh
bash /tmp/doks-bootstrap.sh https://github.com/<owner>/<repo>.git
```

Script cài Docker, Git, UFW; mở cổng `22`, `80`, `443`; clone repo vào `/opt/collabspace`.

---

## 2. Cấu hình secret với Vault

Với setup Droplet Compose, Vault là nguồn sự thật cho secret. Các app NestJS vẫn đọc biến môi trường; script deploy sync Vault → file `.env` trước khi `docker compose up`.

Dùng Vault single-node persistent:

```sh
cd /opt/collabspace/infrastructure/docker
docker compose -f docker-compose.vault.prod.yml up -d
cd /opt/collabspace
bash infrastructure/vault/scripts/init-prod-vault.sh
```

Script init in ra `VAULT_TOKEN` read-only — ghi vào `infrastructure/deploy/doks.env`.

Tạo file cấu hình:

```sh
cp infrastructure/deploy/doks.env.example infrastructure/deploy/doks.env
nano infrastructure/deploy/doks.env
cp infrastructure/vault/.env.example infrastructure/vault/.env
nano infrastructure/vault/.env
```

Seed Vault:

```sh
VAULT_TOKEN=<root-token-từ-infrastructure/vault/.vault-prod-init.json> \
VAULT_KV_PATH=collabspace/prod \
  bash infrastructure/vault/scripts/seed-dev-secrets.sh
```

Giữ trong `infrastructure/deploy/doks.env`:

```sh
USE_VAULT_SYNC=true
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=<read-token-từ-init-prod-vault.sh>
VAULT_KV_PATH=collabspace/prod
COLLABSPACE_IMAGE_REGISTRY=ghcr.io/<github-owner>
```

Script deploy chạy `infrastructure/vault/scripts/sync-env-from-vault.sh`, tạo/cập nhật:

- `services/auth-service/.env`
- `services/user-service/.env`
- `services/workspace-service/.env`
- `services/task-service/.env`
- `services/notification-service/.env`
- `infrastructure/redis/.env`
- `infrastructure/redis/redis.conf`

**Cờ production** (`docker-compose.prod.yml`):

- `NODE_ENV=production` trên mọi service
- `ALLOW_DEV_IDENTITY_HEADERS=false` (workspace, task, notification)
- `DATABASE_SYNCHRONIZE=false` (workspace)
- `SERVICE_JWT_SECRET` giống nhau trên user/workspace/task/notification
- `WORKSPACE_CLIENT_MODE=http` (task-service)
- `RUN_MIGRATIONS=true` khi deploy thường
- `RUN_SEED=true` chỉ khi cần nạp dữ liệu demo

**Không** dùng Vault `-dev` mode cho production lâu dài. Production thật nên Vault HA hoặc secret manager managed.

---

## 3. Cấu hình GitHub Secrets

GitHub → repository **Settings** → **Secrets and variables** → **Actions**:

| Secret | Giá trị |
|--------|---------|
| `DROPLET_HOST` | IP Droplet |
| `DROPLET_USER` | `root` |
| `DROPLET_SSH_KEY` | Private key SSH vào Droplet |
| `GHCR_USERNAME` | Username GitHub |
| `GHCR_TOKEN` | PAT có `read:packages` |

Workflow dùng `GITHUB_TOKEN` để push image GHCR. Droplet dùng `GHCR_TOKEN` để pull image private. Nếu package GHCR **public**, `GHCR_USERNAME` và `GHCR_TOKEN` có thể bỏ qua.

---

## 4. Deploy

Push lên `main`, hoặc chạy workflow thủ công:

```text
Actions → Build Images And Deploy → Run workflow
```

Deploy thủ công trên Droplet:

```sh
cd /opt/collabspace
bash infrastructure/deploy/doks-deploy.sh
```

---

## 5. Kiểm tra

Trên Droplet:

```sh
docker ps
curl http://localhost/api/v1/auth/health
curl http://localhost/api/v1/auth/health/ready
```

Từ máy local:

```sh
curl http://<ip-droplet>/api/v1/auth/health
```

Smoke test MVP:

```sh
cd /opt/collabspace
BASE_URL=http://localhost/api/v1 ./scripts/demo-e2e.sh
```

---

## Ghi chú

- Giữ firewall (DigitalOcean hoặc UFW) chỉ mở `22`, `80`, `443`.
- Không expose Traefik dashboard cổng `8080` ra internet.
- Bật backup tự động Droplet; dùng script `infrastructure/backup/scripts/` cho backup DB.

## Tài liệu liên quan

- [deployment-k3s-phases.md](./deployment-k3s-phases.md) — production khuyến nghị
- [backup-policy.md](./backup-policy.md)
- [production-hardening.md](./production-hardening.md)
