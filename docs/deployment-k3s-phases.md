# Triển khai production trên DigitalOcean — Lộ trình theo phase (k3s)

Tài liệu này mô tả **thứ tự triển khai** CollabSpace lên **một Droplet DigitalOcean** chạy **k3s single-node**, **Helm**, **Vault + ESO**, và toàn bộ stack ứng dụng + datastore.

**Phương án đã chọn:** xem [digitalocean-production-options.md](./digitalocean-production-options.md).

**Đường deploy legacy (Docker Compose):** chỉ dùng cho demo nhanh — xem [deployment-digitalocean-droplet.md](./deployment-digitalocean-droplet.md).

---

## Tổng quan các phase

| Phase | Tên | Thời gian ước tính | Kết quả |
|-------|-----|---------------------|---------|
| 0 | Chuẩn bị | 1–2 ngày | Droplet, domain, `values-prod.yaml` draft |
| 1 | Bootstrap k3s | 0,5–1 ngày | Cluster Ready, namespace `collabspace` |
| 2 | Vault + ESO | 1 ngày | Secret sync từ Vault → K8s Secret |
| 3 | Deploy ứng dụng | 1 ngày | API chạy qua Traefik, smoke test pass |
| 4 | CI/CD | 1 ngày | Push `main` → image mới → Helm deploy |
| 5 | Production hardening | 2–3 ngày | TLS, backup, monitoring, checklist |
| 6 | Nâng cấp (tùy chọn) | Sau launch | DOKS, managed DB, Vault HA |

```text
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
                                                              │
                                                              ▼
                                                         Phase 6 (khi cần)
```

---

## Phase 0 — Chuẩn bị

**Mục tiêu:** Có đủ tài nguyên và quyết định kỹ thuật trước khi cài cluster.

**Checklist chi tiết (Phase 0):** [infrastructure/deploy/phase0-checklist.md](../infrastructure/deploy/phase0-checklist.md)

### Bước nhanh

```bash
# 1. Copy biến môi trường Phase 0
cp infrastructure/deploy/phase0.env.example infrastructure/deploy/phase0.env
# Điền DROPLET_HOST, PROD_DOMAIN, GHCR_OWNER, secret mạnh (IMAGE_TAG có thể để latest — script tự lấy origin/main)

# 2. Sinh values-prod.yaml (gitignored)
chmod +x infrastructure/deploy/prepare-prod-values.sh
./infrastructure/deploy/prepare-prod-values.sh
# Windows: ./infrastructure/deploy/prepare-prod-values.ps1
# prepare-prod-values / helm-rollout tự refresh IMAGE_TAG từ git origin/main (hoặc HEAD) và sync vào phase0.env
```

### Artifact trong repo

| File | Commit? | Mục đích |
|------|---------|----------|
| `infrastructure/helm/collabspace/values-prod.example.yaml` | ✅ | Mẫu Helm production (1 replica, GHCR, ESO) |
| `infrastructure/deploy/phase0.env.example` | ✅ | Mẫu biến Droplet/domain/secret |
| `infrastructure/deploy/phase0.env` | ❌ gitignore | Giá trị thật local |
| `infrastructure/helm/collabspace/values-prod.yaml` | ❌ gitignore | Output Helm cho cluster |

### Hạ tầng

| Hạng mục | Gợi ý |
|----------|-------|
| Droplet | Ubuntu 24.04 LTS, 4 vCPU, 8 GiB RAM, 160 GiB SSD (~48 USD/tháng) |
| Region | `SGP1` (hoặc gần user nhất) |
| Domain | A record → IP Droplet (`api.tenmien.com`) |
| Firewall | Mở `22`, `80`, `443`; **không** public port DB/Vault/K8s API |

### Registry & image

- GitHub Actions build 5 image và push GHCR: `ghcr.io/<owner>/collabspace-<service>`
- Workflow: `.github/workflows/docker-deploy.yml` (job `build-images` ✅)
- Tag theo commit SHA: `git rev-parse origin/main`

### Vault path (chuẩn bị seed ở Phase 2)

`secret/collabspace/prod` — cùng giá trị với `phase0.env`. Xem [infrastructure/vault/README.md](../infrastructure/vault/README.md).

**Lưu ý RAM:** Droplet 8 GiB **bắt buộc** 1 replica mỗi service (`values-prod.example.yaml` đã cấu hình sẵn).

**Definition of Done:** SSH vào Droplet được; `values-prod.yaml` đã tạo; DNS trỏ đúng IP; checklist Phase 0 tick hết.

---

## Phase 1 — Bootstrap k3s

**Mục tiêu:** Kubernetes single-node chạy ổn định.

**Scripts & verify:** `k3s-bootstrap.sh`, `verify-phase1.sh` — xem mục dưới.

### Bước nhanh (trên Droplet)

```bash
cd /opt/collabspace   # hoặc clone repo trước
sudo bash infrastructure/deploy/k3s-bootstrap.sh
sudo bash infrastructure/deploy/verify-phase1.sh
```

One-liner (clone + bootstrap):

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/collabspace/main/infrastructure/deploy/k3s-bootstrap.sh \
  | sudo bash -s -- https://github.com/<owner>/collabspace.git
```

### Script trong repo

| Script | Mục đích |
|--------|----------|
| `infrastructure/deploy/k3s-bootstrap.sh` | Cài k3s, UFW, Helm, namespace, `helm dependency update` |
| `infrastructure/deploy/verify-phase1.sh` | Kiểm tra DoD Phase 1 |
| `infrastructure/deploy/fetch-kubeconfig.sh` | Copy kubeconfig về máy local (Linux/macOS) |
| `infrastructure/deploy/fetch-kubeconfig.ps1` | Copy kubeconfig (Windows) |

### Kubeconfig local (tùy chọn)

```bash
./infrastructure/deploy/fetch-kubeconfig.sh <DROPLET_IP>
export KUBECONFIG=~/.kube/collabspace-prod.yaml
kubectl get nodes
```

| Việc | Chi tiết |
|------|----------|
| Tắt Traefik built-in k3s | `--disable traefik` — Traefik do Helm chart cài |
| StorageClass | k3s `local-path` mặc định |
| Repo trên Droplet | `/opt/collabspace` |

**Definition of Done:** `verify-phase1.sh` pass; `helm dependency update` thành công.

---

## Phase 2 — Vault + External Secrets Operator

**Mục tiêu:** Secret không nằm trong Git; app đọc env từ K8s Secret.

**Scripts & verify:** `vault-eso-phase2.sh`, `verify-phase2.sh` — xem mục dưới.

```text
Vault KV secret/collabspace/prod
  → ExternalSecret (ESO)
  → Kubernetes Secret: auth-service-secrets, ...
  → Deployment envFrom.secretRef
  → NestJS process.env
```

### Bước nhanh (trên Droplet)

```bash
cd /opt/collabspace
# Cần phase0.env đã điền secret
sudo bash infrastructure/deploy/vault-eso-phase2.sh
sudo bash infrastructure/deploy/verify-phase2.sh
```

### Artifact trong repo

| File | Mục đích |
|------|----------|
| `infrastructure/deploy/vault-eso-phase2.sh` | Cài ESO + Vault, init, seed, apply ExternalSecrets |
| `infrastructure/deploy/verify-phase2.sh` | Kiểm tra DoD Phase 2 |
| `infrastructure/vault/k8s/vault-values-k3s.yaml` | Helm values Vault standalone |
| `infrastructure/vault/k8s/external-secrets.prod.yaml` | ExternalSecret → `collabspace/prod` |
| `infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh` | Seed Vault từ `phase0.env` |

File gitignored sau chạy: `.vault-k3s-init.json`, `.vault-k3s-eso-token.json`

### Thứ tự (tự động trong script)

1. Cài External Secrets Operator (Helm)
2. Cài Vault persistent (**không** dev mode)
3. Init / unseal — **backup** `.vault-k3s-init.json` ngoài Droplet
4. KV v2 `secret/`, policy `collabspace-prod-read`, token ESO
5. Seed `secret/collabspace/prod` từ `phase0.env`
6. `cluster-secret-store.yaml` + `external-secrets.prod.yaml`

Password Bitnami trong `values-prod.yaml` phải **khớp** Vault (`postgres_password`, `mongo_password`, …) — Phase 3.

**Definition of Done:** `verify-phase2.sh` pass; 5 ExternalSecret `Ready`; 5 K8s Secret tồn tại.

---

## Phase 3 — Deploy ứng dụng (Helm)

**Mục tiêu:** Toàn bộ stack chạy; API truy cập được.

**Scripts & verify:** `helm-deploy-phase3.sh`, `verify-k8s-readiness.sh`, `run-demo-e2e-prod.sh` — xem mục dưới.

### Bước nhanh (trên Droplet)

```bash
cd /opt/collabspace
# Cần values-prod.yaml (Phase 0) + Phase 2 pass
sudo bash infrastructure/deploy/helm-deploy-phase3.sh
sudo bash infrastructure/deploy/verify-phase3.sh
```

### Script trong repo

| Script | Mục đích |
|--------|----------|
| `infrastructure/deploy/helm-deploy-phase3.sh` | Helm install, chờ datastore, migration, rollout app |
| `infrastructure/deploy/run-k8s-migrations.sh` | Job K8s: auth → user → workspace (`migrate:prod`) |
| `infrastructure/deploy/verify-phase3.sh` | Kiểm tra DoD Phase 3 |
| `infrastructure/deploy/verify-k8s-readiness.sh` | `curl` readiness qua Traefik |

### Thứ tự (tự động trong script)

1. PostgreSQL, MongoDB, Redis, Kafka + Debezium Connect (Helm subcharts / `infrastructure/kafka/`)
2. **Migration** (thứ tự bắt buộc): `auth-service` → `user-service` → `workspace-service`
3. Rollout 5 app services
4. Traefik IngressRoute — route `/api/v1/*`
5. Smoke test

```bash
# Readiness qua gateway (tự resolve Traefik IP)
sudo bash infrastructure/deploy/verify-k8s-readiness.sh

# MVP E2E (tùy chọn)
BASE_URL=http://<ip>/api/v1 ./scripts/demo-e2e.sh
```

**Migration trong image production:** `pnpm run migrate:prod` (`node dist/src/migrate.js`) — không dùng `ts-node`. TypeORM class migrations (`services/<svc>/migrations/*.ts`) compile vào `dist/migrations/`; runner `@collabspace/typeorm-migrate`.

**Cờ production quan trọng:**

- `ALLOW_DEV_IDENTITY_HEADERS=false` (workspace, task, notification)
- `NODE_ENV=production`
- `DATABASE_SYNCHRONIZE=false` (workspace-service)

**Definition of Done:** `verify-phase3.sh` pass; tất cả pod `Running`; readiness 200 qua gateway.

---

## Phase 4 — CI/CD tự động

**Mục tiêu:** Push `main` → build image → deploy Helm không cần SSH tay.

**Scripts & verify:** `helm-deploy-ci.sh`, workflow `docker-deploy.yml` — xem mục dưới.

### Workflow

File: `.github/workflows/docker-deploy.yml`

| Job | Việc |
|-----|------|
| `build-images` | Build & push **cả 5** image GHCR (cùng tag = commit SHA; `fail-fast: true`) |
| `deploy` | SSH Droplet → `helm-deploy-ci.sh` → `verify-k8s-readiness.sh` |

Workflow `CI` (`.github/workflows/ci.yml`) chạy riêng trên PR/push: `pnpm build` + `test`.

### Pipeline

```text
push main (hoặc workflow_dispatch)
  → build-images (GHCR)
  → deploy over SSH
       → git pull /opt/collabspace
       → helm-deploy-ci.sh (helm upgrade + migration + rollout)
       → verify-k8s-readiness.sh
```

### Script trong repo

| Script | Mục đích |
|--------|----------|
| `infrastructure/deploy/helm-deploy-ci.sh` | Entrypoint CI — bắt buộc `IMAGE_TAG` |
| `infrastructure/deploy/helm-rollout.sh` | Logic chung Helm + migration (Phase 3 & 4) |
| `infrastructure/deploy/verify-k8s-readiness.sh` | Smoke readiness qua Traefik |

### GitHub Secrets

| Secret | Mục đích |
|--------|----------|
| `DROPLET_HOST` | IP Droplet |
| `DROPLET_USER` | User SSH (`root`) |
| `DROPLET_SSH_KEY` | Private key SSH |
| `GHCR_USERNAME` / `GHCR_TOKEN` | Pull image private trên cluster (nếu cần) |

**Không** cần `KUBECONFIG` trong GitHub — CI SSH vào Droplet và dùng `/etc/rancher/k3s/k3s.yaml`.

### Điều kiện trên Droplet

- Phase 1–3 đã chạy; `values-prod.yaml` + `phase0.env` có trên server
- Repo clone tại `/opt/collabspace`

**Definition of Done:** Push `main` → Actions job `deploy` xanh → readiness 200 qua gateway.

---

## Phase 5 — Production hardening

**Mục tiêu:** An toàn và vận hành được lâu dài trên single-node.

| Hạng mục | Việc |
|----------|------|
| TLS | cert-manager + Let's Encrypt trên Traefik |
| Backup | CronJob `pg_dump` + `mongodump` → DO Spaces / S3 |
| Restore drill | Test restore 1 lần; ghi RTO thực tế |
| Metrics | `metricsAuthToken`; Prometheus scrape; Grafana `/grafana` — [observability.md](./observability.md) |
| Logs | Loki + Promtail; tail qua Grafana **Explore** (không ELK trên K8s) |
| Load test | k6 `smoke` / `demo-flow` + dashboard **Load Test Run** |
| NetworkPolicy | Giữ `networkPolicies.enabled: true` |
| Firewall | Không expose Traefik dashboard `8080`, Vault `8200` |
| Runbook | On-call biết restart / restore / rotate secret |

Checklist đầy đủ: [production-hardening.md](./production-hardening.md).

**Definition of Done:** Checklist production-hardening pass ≥ 80%; backup tự động hàng ngày.

---

## Phase 6 — Nâng cấp (khi cần)

Chỉ làm khi có user thật hoặc cần SLA cao hơn:

```text
Droplet + k3s
  → DOKS 3 worker (không HA control plane)
  → Managed PostgreSQL + MongoDB Atlas
  → DOKS + HA control plane
  → Vault HA / HCP Vault
```

---

## Ranh giới môi trường

| Môi trường | Công cụ | Tài liệu |
|------------|---------|----------|
| Local dev | Docker Compose | `infrastructure/docker/` |
| Production (DO) | k3s + Helm + Vault + ESO | Tài liệu này |
| Legacy / demo nhanh | Docker Compose trên Droplet | [deployment-digitalocean-droplet.md](./deployment-digitalocean-droplet.md) |
| Tham chiếu YAML | `infrastructure/k8s/` | Không dùng cho deploy mới |

---

## Rủi ro chấp nhận (single-node)

| Rủi ro | Tác động | Giảm thiểu |
|--------|----------|------------|
| Droplet chết | Toàn hệ thống down | DO backup/snapshot; runbook restore |
| Disk đầy | DB/Vault lỗi | Alert disk; log rotation |
| Mất Vault unseal key | Không operate Vault | Lưu key ở password manager |
| PVC mất | Mất dữ liệu DB | Backup DB riêng |
| Deploy lỗi | App down một phần | `helm rollback`; readiness probe |

---

## Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| [digitalocean-production-options.md](./digitalocean-production-options.md) | So sánh phương án DO |
| [production-hardening.md](./production-hardening.md) | Checklist bảo mật & vận hành |
| [backup-policy.md](./backup-policy.md) | RPO/RTO, backup Postgres/Mongo |
| [infrastructure/helm/README.md](../infrastructure/helm/README.md) | Helm chart |
| [infrastructure/vault/README.md](../infrastructure/vault/README.md) | Vault + ESO |
| [team/phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) | Backlog infra |
