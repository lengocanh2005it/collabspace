# Phase 0 — Checklist chuẩn bị production (k3s)

Hoàn thành checklist này **trước** khi cài k3s (Phase 1).  
Lộ trình đầy đủ: [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md).

## 1. DigitalOcean Droplet

- [ ] Tạo Droplet Ubuntu 24.04 LTS — 4 vCPU, 8 GiB RAM, 160 GiB SSD (~48 USD/tháng)
- [ ] Gắn SSH key (không dùng password root)
- [ ] Ghi IP: `_______________`
- [ ] Bật backup/snapshot Droplet (khuyến nghị)
- [ ] Firewall: inbound `22`, `80`, `443` — chặn `5432`, `27017`, `6379`, `5672`, `8200`, `6443` từ internet

## 2. Domain & DNS

- [ ] Mua / chọn domain
- [ ] A record `api.<domain>` → IP Droplet
- [ ] (Phase 5) Chuẩn bị cert-manager + Let's Encrypt

## 3. GHCR images

- [ ] Xác nhận workflow `Build Images And Deploy` → job `build-images` pass trên `main`
- [ ] Image pattern: `ghcr.io/<owner>/collabspace-<service>:<sha>`
- [ ] Quyết định package public hay private:
  - **Public:** bỏ `imagePullSecrets` trong `values-prod.yaml`
  - **Private:** cần `ghcr-credentials` secret trên cluster (Phase 2/3)

Lấy tag mới nhất:

```bash
gh run list --workflow "Build Images And Deploy" --branch main --limit 1
# hoặc commit SHA trên main
git rev-parse origin/main
```

## 4. File cấu hình Helm (local)

```bash
cp infrastructure/deploy/phase0.env.example infrastructure/deploy/phase0.env
# Điền secret mạnh — openssl rand -base64 32

# Linux/macOS
chmod +x infrastructure/deploy/prepare-prod-values.sh
./infrastructure/deploy/prepare-prod-values.sh

# Windows
./infrastructure/deploy/prepare-prod-values.ps1
```

- [ ] `infrastructure/deploy/phase0.env` tồn tại (gitignored)
- [ ] `infrastructure/helm/collabspace/values-prod.yaml` được tạo (gitignored)
- [ ] **Không** commit `phase0.env` / `values-prod.yaml`

## 5. Vault keys (chuẩn bị seed Phase 2)

Cùng giá trị với `phase0.env` → path `secret/collabspace/prod`:

| Vault key | Biến phase0.env |
|-----------|-----------------|
| `jwt_secret` | `JWT_SECRET` |
| `internal_service_token` | `INTERNAL_SERVICE_TOKEN` |
| `postgres_password` | `POSTGRES_PASSWORD` |
| `mongo_username` | `admin` (mặc định) |
| `mongo_password` | `MONGO_PASSWORD` |
| `redis_password` | `REDIS_PASSWORD` |
| `rabbitmq_username` | `RABBITMQ_USERNAME` |
| `rabbitmq_password` | `RABBITMQ_PASSWORD` |
| `metrics_auth_token` | `METRICS_AUTH_TOKEN` |

Chi tiết: [infrastructure/vault/README.md](../vault/README.md).

## 6. GitHub Actions secrets (Phase 4 — có thể chuẩn bị sớm)

Repository → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `DROPLET_HOST` | Có | IP Droplet |
| `DROPLET_USER` | Có | `root` |
| `DROPLET_SSH_KEY` | Có | Private key SSH |
| `GHCR_USERNAME` | Nếu image private | Username GitHub |
| `GHCR_TOKEN` | Nếu image private | PAT `read:packages` |

## 7. Kiểm tra cuối Phase 0

```bash
ssh root@<DROPLET_IP> "echo ok"
test -f infrastructure/helm/collabspace/values-prod.yaml && echo "values-prod.yaml ok"
```

- [ ] SSH vào Droplet thành công
- [ ] DNS resolve `api.<domain>` → IP Droplet
- [ ] `values-prod.yaml` có image GHCR + `externalSecrets.enabled: true`
- [ ] Secret đã sinh và lưu an toàn (password manager / Vault draft)

**Xong Phase 0 →** [Phase 1 checklist](./phase1-checklist.md)
