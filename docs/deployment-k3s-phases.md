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

**Checklist chi tiết:** [infrastructure/deploy/phase0-checklist.md](../infrastructure/deploy/phase0-checklist.md)

### Bước nhanh

```bash
# 1. Copy biến môi trường Phase 0
cp infrastructure/deploy/phase0.env.example infrastructure/deploy/phase0.env
# Điền DROPLET_HOST, PROD_DOMAIN, GHCR_OWNER, IMAGE_TAG, secret mạnh

# 2. Sinh values-prod.yaml (gitignored)
chmod +x infrastructure/deploy/prepare-prod-values.sh
./infrastructure/deploy/prepare-prod-values.sh
# Windows: ./infrastructure/deploy/prepare-prod-values.ps1
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

**Checklist:** [infrastructure/deploy/phase1-checklist.md](../infrastructure/deploy/phase1-checklist.md)

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

```text
Vault KV secret/collabspace/prod
  → ExternalSecret (ESO)
  → Kubernetes Secret: auth-service-secrets, ...
  → Deployment envFrom.secretRef
  → NestJS process.env
```

### Thứ tự

1. Cài [External Secrets Operator](https://external-secrets.io/latest/introduction/getting-started/)
2. Deploy Vault persistent (**không** dùng `-dev` mode)
3. `init` / `unseal` Vault — lưu unseal keys **ngoài** Droplet
4. Enable KV v2 mount `secret/`
5. Seed `secret/collabspace/prod`
6. Tạo policy read-only cho ESO; production nên dùng [Kubernetes auth](https://developer.hashicorp.com/vault/docs/auth/kubernetes)
7. Apply manifest: `infrastructure/vault/k8s/cluster-secret-store.yaml`, `external-secrets.yaml`
8. Đồng bộ password Bitnami subchart với Vault (`postgres_password`, `mongo_password`, …)

```bash
kubectl apply -f infrastructure/vault/k8s/cluster-secret-store.yaml
kubectl apply -f infrastructure/vault/k8s/external-secrets.yaml
kubectl get externalsecrets -n collabspace
kubectl get secret auth-service-secrets -n collabspace
```

**Definition of Done:** ExternalSecret trạng thái `Synced`; K8s Secret tồn tại; không dùng root token cho app.

---

## Phase 3 — Deploy ứng dụng (Helm)

**Mục tiêu:** Toàn bộ stack chạy; API truy cập được.

```bash
helm upgrade --install collabspace infrastructure/helm/collabspace \
  -n collabspace \
  -f infrastructure/helm/collabspace/values.yaml \
  -f infrastructure/helm/collabspace/values-prod.yaml
```

### Thứ tự sau khi data layer Ready

1. PostgreSQL, MongoDB, Redis, RabbitMQ (Bitnami subcharts + PVC)
2. **Migration** (thứ tự bắt buộc): `auth-service` → `user-service` → `workspace-service`
3. Rollout 5 app services
4. Traefik IngressRoute — route `/api/v1/*`
5. Smoke test

```bash
# Trên cluster hoặc qua port-forward
curl -fsS http://<ip>/api/v1/auth/health
curl -fsS http://<ip>/api/v1/auth/health/ready

# MVP E2E
BASE_URL=http://<ip>/api/v1 ./scripts/demo-e2e.sh
```

**Cờ production quan trọng:**

- `ALLOW_DEV_IDENTITY_HEADERS=false` (workspace, task, notification)
- `NODE_ENV=production`
- `DATABASE_SYNCHRONIZE=false` (workspace-service)

**Definition of Done:** Tất cả pod `Running`; demo story 7 bước pass; readiness 200.

---

## Phase 4 — CI/CD tự động

**Mục tiêu:** Push `main` → build image → deploy Helm không cần SSH tay.

### Hiện trạng workflow

| Job | Trạng thái |
|-----|------------|
| `CI / build-test` | ✅ Pass |
| `build-images` (5 service → GHCR) | ✅ Pass |
| `deploy` (SSH + Docker Compose) | ❌ Cần thay bằng Helm/k3s |

### Pipeline mục tiêu

```text
push main
  → pnpm build + test
  → build & push 5 images (GHCR)
  → helm upgrade --install (kubeconfig / SSH)
  → migration Job (nếu schema đổi)
  → verify-readiness.sh + demo-e2e (smoke)
```

### GitHub Secrets cần có

| Secret | Mục đích |
|--------|----------|
| `DROPLET_HOST` | IP Droplet |
| `DROPLET_USER` | User SSH (`root`) |
| `DROPLET_SSH_KEY` | Private key SSH |
| `KUBECONFIG` hoặc setup trên server | `kubectl` / `helm` từ CI |
| `GHCR_USERNAME` / `GHCR_TOKEN` | Pull image private (nếu package không public) |

**Definition of Done:** Merge PR → Actions xanh → version mới live.

---

## Phase 5 — Production hardening

**Mục tiêu:** An toàn và vận hành được lâu dài trên single-node.

| Hạng mục | Việc |
|----------|------|
| TLS | cert-manager + Let's Encrypt trên Traefik |
| Backup | CronJob `pg_dump` + `mongodump` → DO Spaces / S3 |
| Restore drill | Test restore 1 lần; ghi RTO thực tế |
| Metrics | `metricsAuthToken`; Prometheus scrape nội bộ |
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
