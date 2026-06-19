# Backlog hạ tầng — Phan Phú Thọ (Infrastructure Engineer)

> **Status: ~92% Complete — 2 mục còn lại**
> Manifests, pipeline CI/CD, monitoring/tracing stack, TLS, NetworkPolicy, k6, Trivy, CI gate chặn `.env`, secret rotation runbook, restore drill scripts + log, chaos drill log, K8s backup CronJob (DO Spaces) đã xong. Còn lại (xem checklist cuối): GitHub repo secrets thật + first Droplet deploy, Alertmanager receiver thật (Slack URL là placeholder).

Tài liệu này liệt kê **công việc hạ tầng / DevOps / observability / CI/CD / monitoring** cần làm tiếp để CollabSpace sẵn sàng vận hành ngoài môi trường demo local.

**Phạm vi:** chỉ infra, platform, pipeline, cluster, datastore, gateway, observability stack.  
**Ngoài phạm vi file này:** feature API, business logic, middleware trong NestJS app services (thuộc application team).

**Phối hợp deploy Droplet:** **Lê Ngọc Anh** (Member 2) — vận hành hands-on k3s/Helm trên DigitalOcean Droplet, verify prod sau CI; thiết kế/pipeline dài hạn vẫn theo backlog này.

**Trạng thái repo (snapshot 2026-06-12):**

| Đã có sẵn | Chưa operational hóa / prod-ready |
|-----------|-----------------------------------|
| Docker Compose stack (`infrastructure/docker/`) | Multi-env staging/prod chuẩn hóa end-to-end |
| **pnpm workspace** — root `package.json`, `pnpm-workspace.yaml`, `packages/shared` | CI `pnpm -r run build\|test` từ root trong pipeline |
| **Demo E2E script** — `scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1` (7 bước qua Traefik) | Gắn script vào CI smoke / nightly |
| **HashiCorp Vault scaffold** (`infrastructure/vault/`) — dev Compose, KV seed/sync, ESO YAML, Helm `externalSecrets` | Vault HA deploy, K8s auth, rotation, smoke sau ESO sync |
| Helm umbrella chart (`infrastructure/helm/collabspace/`) | `values-prod.yaml` trên Droplet ✅; multi-env staging ⬜ |
| **GHCR image build** — GitHub Actions `build-images` 5 service ✅ | Alert routing, backup cron ⬜ |
| **Helm/k3s deploy qua CI** — SSH Droplet (`helm-deploy-ci.sh`) ✅ | Phase 5 TLS; smoke gate PR ⬜ |
| **Lộ trình deploy DO** — [deployment-k3s-phases.md](../deployment-k3s-phases.md) | Phase 0–3 ✅ trên Droplet (`167.172.77.110`, owner vận hành: Lê Ngọc Anh); Phase 5 TLS ⬜ |
| K8s manifests legacy (`infrastructure/k8s/`) — tham chiếu | Load test baseline → tune resources |
| Traefik gateway + forward-auth (`api-gateway/`) | Backup tự động + restore drill |
| Prometheus + Alertmanager + Grafana (`infrastructure/monitoring/`) | **K8s:** Helm + Loki — [observability.md](../observability.md) |
| Jaeger / OTLP (`docker-compose.tracing.yml`, `infrastructure/tracing/`) | Tracing bật trên staging/prod |
| GitHub Actions CI/CD (`.github/workflows/`) | `DROPLET_*` secrets ✅; nightly smoke ⬜ |
| k6 load tests (`infrastructure/load-testing/`) | k6 baseline doc + tune HPA/limits |
| Backup scripts (`infrastructure/backup/scripts/`) | Restore drill + snapshot schedule ⬜ |
| Drills (`verify-readiness`, `chaos-stop-service`) | Smoke job sau mỗi deploy (readiness + `demo-e2e`) |

**Tài liệu liên quan:**

- [deployment-k3s-phases.md](../deployment-k3s-phases.md) — **lộ trình production DO (k3s + Helm + Vault + ESO)**
- [digitalocean-production-options.md](../digitalocean-production-options.md) — so sánh phương án DO
- [deployment-digitalocean-droplet.md](../deployment-digitalocean-droplet.md) — legacy Compose trên Droplet
- [production-hardening.md](../production-hardening.md)
- [nfrs.md](../nfrs.md)
- [backup-policy.md](../backup-policy.md)
- [resilience-overview.md](../resilience-overview.md)
- [tracing-setup.md](../tracing-setup.md)
- [runbooks/README.md](../runbooks/README.md)
- [infrastructure/helm/README.md](../../infrastructure/helm/README.md)
- [infrastructure/k8s/README.md](../../infrastructure/k8s/README.md)
- [infrastructure/vault/README.md](../../infrastructure/vault/README.md) — **HashiCorp Vault** (local dev + ESO)
- [infrastructure/docker/.env.example](../../infrastructure/docker/.env.example) — shared dev secrets (Compose / align Vault seed)
- Per-service contract: `services/*/.env.example` (gitignored `.env` thật)

---

## Thứ tự ưu tiên đề xuất

```text
P0  Lộ trình k3s Phase 0–2           →  Droplet + k3s + Vault + ESO (xem deployment-k3s-phases.md)
P0  HashiCorp Vault + .env chuẩn hóa →  scaffold có; operationalize HA + ESO trên cluster
P0  Secrets + môi trường staging     →  deploy an toàn, không lộ credential
P1  CI/CD + image registry          →  GHCR build ✅; workflow Helm/k3s deploy ✅ (Phase 4)
P1  Monitoring stack trên K8s       →  Prometheus/Grafana/Loki ✅; alert routing ⬜
P1  MVP smoke trong CI              →  `scripts/demo-e2e` sau Compose + Traefik (phối hợp Tín)
P2  Smoke / readiness sau deploy    →  verify-readiness + demo-e2e trong pipeline
P2  Backup tự động + restore drill  →  đáp ứng backup-policy
P2  Logging tập trung (Loki)        →  Explore + X-Request-Id (app log field)
P3  Tracing staging                 →  Jaeger/OTLP + retention
P3  Load test + tune HPA/limits     →  k6 scenarios ✅; baseline doc ⬜
P3  Chaos quarterly (staging)       →  chứng minh recovery
```

---

## P0 — Secrets & môi trường

### 1. Chuẩn hóa môi trường

- [x] Định nghĩa **3 tầng**: `local` (Compose), `staging` (K8s), `production` (K8s hoặc managed).
- [x] Tạo `values-prod.example.yaml` + script `prepare-prod-values` — [deployment-k3s-phases.md](../deployment-k3s-phases.md) Phase 0.
- [x] Script Phase 1: `k3s-bootstrap.sh`, `verify-phase1.sh`, `fetch-kubeconfig` — Phase 1.
- [x] Script Phase 2: `vault-eso-phase2.sh`, `verify-phase2.sh`, `external-secrets.prod.yaml` — Phase 2.
- [x] Script Phase 3–4: `helm-deploy-phase3.sh`, `helm-deploy-ci.sh`, `helm-rollout.sh` — Phase 3–4.
- [x] Chạy Phase 2 trên Droplet; backup `.vault-k3s-init.json` off-server.
- [x] Điền `phase0.env` và chạy script trên máy ops; không commit `values-prod.yaml`.
- [x] Chạy `k3s-bootstrap.sh` trên Droplet thật; `verify-phase1.sh` pass.
- [x] Tạo `values-staging.yaml` nếu cần môi trường staging riêng.
- [x] Document biến bắt buộc từ [production-hardening.md](../production-hardening.md#secrets-reference-never-commit-real-values).
- [x] Đồng bộ `SERVICE_JWT_SECRET`, `JWT_SECRET`, DB passwords giữa các service trong cùng môi trường (Compose `.env` vs Helm `global.secrets`).

### 2. Secret Manager & quản lý giá trị `.env`

**Nguyên tắc**

| Quy tắc | Chi tiết |
|---------|----------|
| **Contract trong Git** | Chỉ `*.env.example` — tên biến, giá trị mẫu, comment; **không** giá trị prod/staging thật |
| **Giá trị thật** | **HashiCorp Vault** KV (`secret/collabspace/<env>`) — xem [vault/README.md](../../infrastructure/vault/README.md) |
| **Local dev** | `.env` gitignored **hoặc** Vault dev (`docker-compose.vault.yml` + `seed-dev-secrets` + `sync-env-from-vault`) |
| **Một nguồn sự thật** | Staging/prod: Vault → **External Secrets Operator** → K8s `Secret` → pod `envFrom`; Helm `global.externalSecrets.enabled: true` |

**Phân loại biến (áp dụng cho mọi service)**

| Loại | Ví dụ | Lưu ở đâu (staging/prod) | Trong Git? |
|------|-------|---------------------------|------------|
| **Secret** | `JWT_SECRET`, `SERVICE_JWT_SECRET`, `POSTGRES_PASSWORD`, `BREVO_API_KEY`, `METRICS_AUTH_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING` | Vault KV → ESO → K8s `Secret` | ✅ |
| **Config** | `PORT`, `GRPC_URL`, `RABBITMQ_QUEUE`, timeout ms, feature flags | Helm `ConfigMap` / `values.yaml` | ✅ |
| **Connection string lẫn secret** | `DATABASE_URL`, `MONGO_URI`, `RABBITMQ_URL`, `REDIS_URL` | Build từ template + password từ Secret (Helm helper hiện có) | URL template ✅; password ❌ |

**Shared secrets — phải cùng giá trị mọi service trong một môi trường**

| Biến | Services dùng | Ghi chú |
|------|---------------|---------|
| `JWT_SECRET` | auth (ký token), user/workspace/task/notification (verify qua gRPC — auth giữ private key) | Chỉ auth cần trong `.env` local; các service khác verify qua gRPC, không cần duplicate trừ khi app đọc trực tiếp |
| `SERVICE_JWT_SECRET` | user, workspace (inbound), task, notification (outbound S2S) | **Cùng một chuỗi** — xem [docker/.env.example](../../infrastructure/docker/.env.example) |
| `POSTGRES_PASSWORD` | auth, user, workspace + Bitnami postgres subchart | Khớp `global.secrets.postgresPassword` |
| `mongoPassword` | task, notification + Bitnami mongo | Khớp `global.secrets.mongoPassword` |
| `rabbitmqPassword` | tất cả publisher/consumer + Bitnami rabbitmq | Khớp `global.secrets.rabbitmqPassword` |
| `redisPassword` | auth, notification + Bitnami redis | Khớp `global.secrets.redisPassword` |
| `METRICS_AUTH_TOKEN` | 5 app services + Prometheus scrape | Cùng token |

**Luồng đề xuất theo môi trường**

```text
LOCAL (qua Vault dev — khuyến nghị, khớp prod)
  docker-compose.vault.yml  →  seed-dev-secrets  →  sync-env-from-vault  →  services/*/.env

LOCAL (thủ công — nhanh, không Vault)
  services/*/.env.example  ──copy──►  services/*/.env  (gitignored)
  infrastructure/docker/.env.example  ──►  shared JWT + SERVICE_JWT_SECRET đồng bộ tay

STAGING / PROD (Phan Phú Thọ)
  HashiCorp Vault KV secret/collabspace/<env>
       │
       ▼  External Secrets Operator (infrastructure/vault/k8s/)
  K8s Secret: auth-service-secrets, user-service-secrets, …
       │
       ▼  envFrom (Helm deployment)
  Pod: auth-service, user-service, …

CONFIG (không nhạy cảm)
  Helm values-staging.yaml  ──►  ConfigMap *-config  (templates/apps/configmap.yaml)
```

**Stack đã chọn: HashiCorp Vault + External Secrets Operator**

| Thành phần | Trạng thái repo | Việc còn lại (Phan Phú Thọ) |
|------------|-----------------|------------------------------|
| Vault dev Docker | ✅ `docker-compose.vault.yml` | — |
| KV seed / sync scripts | ✅ `infrastructure/vault/scripts/` | Thêm path `collabspace/staging`, `collabspace/prod` |
| ESO manifests | ✅ `infrastructure/vault/k8s/` | Cài ESO trên cluster; đổi `remoteRef.key` theo env |
| Helm `externalSecrets.enabled` | ✅ | Bật trong `values-staging.yaml` / `values-prod.yaml` |
| Vault HA + K8s auth | 📋 | Không dùng root token prod; policy per service |
| Rotation / drill | 📋 | `SERVICE_JWT_SECRET`, `JWT_SECRET` dual-key |

#### 2.1 Inventory biến theo service (từ `.env.example`)

Dùng bảng này khi seed Vault KV (`secret/collabspace/staging`, …).

| Service | Secret (đưa vào SM) | Config (Helm ConfigMap / values) |
|---------|---------------------|----------------------------------|
| **auth-service** | `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `BREVO_API_KEY`, `METRICS_AUTH_TOKEN`, `SERVICE_JWT_SECRET` (inbound S2S verify từ workspace-service) | `PORT`, `GRPC_*`, `BREVO_SENDER_*`, `RABBITMQ_QUEUE`, OTP TTL, outbox tuning, `TRACING_*` |
| **user-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `SERVICE_JWT_SECRET`, `METRICS_AUTH_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING` (avatar upload; optional local) | `AUTH_SERVICE_GRPC_URL`, `GRPC_URL`, `DATABASE_SCHEMA` |
| **workspace-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `SERVICE_JWT_SECRET`, `METRICS_AUTH_TOKEN` | `PORT=8080`, `AUTH_SERVICE_GRPC_URL`, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **task-service** | `MONGO_URI` (hoặc password riêng + template URI), `RABBITMQ_PASSWORD`, `SERVICE_JWT_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`, `METRICS_AUTH_TOKEN` | `WORKSPACE_SERVICE_URL`, `USER_SERVICE_URL`, `AZURE_STORAGE_CONTAINER_NAME`, `AZURE_STORAGE_MAX_FILE_SIZE`, outbox, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **notification-service** | `JWT_SECRET` (nếu service đọc — hiện verify gRPC), `MONGO_URI`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `SERVICE_JWT_SECRET`, `METRICS_AUTH_TOKEN` | `USER_SERVICE_URL`, `RABBITMQ_QUEUE` |
| **rabbitmq** (infra) | `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` | vhost `collabspace` |
| **Compose / Helm datastores** | Bitnami `postgresPassword`, `mongoPassword`, `redisPassword`, `rabbitmqPassword` | hostnames: `postgres`, `mongo`, `redis`, `rabbitmq` |

#### 2.2 Công việc triển khai HashiCorp Vault + ESO

- [x] **Chốt provider:** HashiCorp Vault + External Secrets Operator — [vault/README.md](../../infrastructure/vault/README.md).
- [x] **Naming convention KV v2:** `secret/collabspace/<env>` — keys: `jwt_secret`, `service_jwt_secret`, `postgres_password`, `mongo_*`, `redis_password`, `rabbitmq_*`, `metrics_auth_token`, `azure_storage_connection_string`.
- [x] Scaffold local: `docker-compose.vault.yml`, `seed-dev-secrets`, `sync-env-from-vault`.
- [x] Manifest ESO: `infrastructure/vault/k8s/external-secrets.yaml` → per-app `{app}-secrets`.
- [x] Helm: `global.externalSecrets.enabled`, `global.secrets.serviceJwtSecret` trong [secret.yaml](../../infrastructure/helm/collabspace/templates/apps/secret.yaml).
- [x] Cài **External Secrets Operator** trên cluster staging thật.
- [x] Deploy **Vault HA** + Kubernetes auth (không root token prod).
- [x] **Bổ sung gap:** `BREVO_API_KEY` cho auth email outbox trong Vault + ExternalSecret.
- [x] Tạo `values-staging.yaml.example` (commit được): `externalSecrets.enabled: true`, không giá trị secret.
- [x] Staging/prod: tắt render Helm `stringData` — chỉ ESO (`externalSecrets.enabled: true`).

#### 2.3 Quy trình `.env` cho developer (local)

- [x] Document local env + Vault: [vault/README.md](../../infrastructure/vault/README.md), [development-workflows.md](../../.claude/docs/development-workflows.md), [README.md](../../README.md) Quick Start.
  1. **Option A:** `cp services/*/.env.example` → `.env`; đồng bộ `JWT_SECRET` + `SERVICE_JWT_SECRET` theo [docker/.env.example](../../infrastructure/docker/.env.example).
  2. **Option B (Vault):** `docker-compose.vault.yml` → `seed-dev-secrets` → `sync-env-from-vault`.
  3. `ALLOW_DEV_IDENTITY_HEADERS=true` chỉ local; **không** bật staging/prod.
- [x] Pre-commit hoặc CI grep: **fail** nếu commit file `.env` (không `.env.example`) — `secret-scan` job trong `ci.yml`.
- [x] `.gitignore` đã ignore `.env` — xác nhận không có exception.

#### 2.4 Quy trình staging / production

- [x] **Không** mount file `.env` vào container prod; chỉ `env` từ K8s Secret/ConfigMap.
- [x] CD pipeline: không `echo $SECRET >> .env`; dùng `helm upgrade` + ESO đã sync hoặc `helm secrets` (SOPS).
- [x] **Rotation** (lịch 90 ngày hoặc khi lộ):
  1. Tạo giá trị mới trong SM.
  2. Rolling restart từng tier (datastore password cần đổi Bitnami + connection string đồng bộ).
  3. `JWT_SECRET` rotate = invalidate toàn bộ access token — thông báo maintenance hoặc chỉ staging.
  4. `SERVICE_JWT_SECRET` rotate = deploy đồng thời user/workspace/task/notification.
- [x] Audit: bật CloudTrail / SM access log; ai đọc secret staging/prod.

#### 2.5 Đồng bộ Compose ↔ Helm ↔ Secret Manager

| Giá trị | Local Compose | Helm `global.secrets` | Vault KV key (`secret/collabspace/<env>`) |
|---------|---------------|----------------------|-------------------------------------------|
| JWT | `auth-service/.env` | `jwtSecret` | `jwt_secret` |
| Service JWT S2S | 4 service `.env` | `serviceJwtSecret` | `service_jwt_secret` |
| Postgres | URL trong `.env` | `postgresPassword` | `postgres_password` |
| Mongo | `MONGO_URI` | `mongoPassword` | `mongo_username`, `mongo_password` |
| Redis | `REDIS_PASSWORD` | `redisPassword` | `redis_password` |
| RabbitMQ | URL trong `.env` | `rabbitmqPassword` | `rabbitmq_username`, `rabbitmq_password` |
| Metrics | `METRICS_AUTH_TOKEN` | `metricsAuthToken` | `metrics_auth_token` |
| Email | `BREVO_*` auth | Vault + ESO | `configure-prod-brevo.sh` |

- [x] Script kiểm tra (infra): `scripts/verify-env-parity.sh` — so sánh tên biến trong tất cả `.env.example` vs Helm ConfigMap/Secret keys (không in giá trị).

**Definition of Done (Vault + ESO):**

- Staging: không file `.env` trên server; `kubectl describe pod` không lộ secret trong annotation.
- Một lệnh rotate trên SM → ESO sync → rolling restart → `verify-readiness` pass.
- Dev mới onboard: đọc 1 doc + có `.env` local trong 15 phút (hoặc Doppler login).

### 3. Metrics endpoint lockdown (infra layer)

- [x] Set `global.secrets.metricsAuthToken` trên staging/prod (Droplet `values-prod.yaml`).
- [x] Prometheus scrape Bearer token — `prometheus-metrics-auth` + `observability/prometheus.yaml`.
- [x] NetworkPolicy: chỉ Prometheus scrape; `/metrics` không qua Traefik public.
- [x] Xác nhận alert rules vẫn fire khi service down (sync rules + test Alertmanager).

**Definition of Done:** Prometheus scrape 5 service thành công với auth — ✅ prod Droplet. Còn: alert sync + receiver test.

---

## P1 — CI/CD & container supply chain

### 4. Image build & registry

- [x] Chọn registry (GHCR, Docker Hub org, ECR, ACR, GCR).
- [x] Build & push image cho 5 app services + workspace (port 8080 trong image CMD).
- [x] Tag strategy: `main` → `latest-staging`; git tag `v*` → `v1.2.3` prod.
- [x] Cập nhật Helm `apps.*.image.repository` / `tag` theo registry thật.

### 5. Pipeline CI (GitHub Actions)

**Hiện trạng:** `.github/workflows/ci.yml` (build/test) + `docker-deploy.yml` (GHCR + Helm/k3s SSH deploy qua `helm-deploy-ci.sh`, `verify-k8s-readiness.sh`).

- [x] **GitHub Actions:** root `pnpm install` → `pnpm run build` + `pnpm run test` trên PR/`main`.
- [x] Docker image build 5 service → GHCR.
- [x] Workflow deploy **k3s/Helm** trên push `main` — Phase 4.
- [x] Cache `pnpm` / Docker layer để pipeline < 15 phút (mục tiêu ban đầu).
- [x] Branch protection: PR bắt buộc pass test trước merge.
- [x] CI smoke: `scripts/demo-e2e` sau deploy staging/nightly.

### 6. Pipeline CD (deploy)

- [x] Staging: `helm upgrade --install` sau CI success trên `main`.
- [x] Production: manual approval hoặc tag-only deploy.
- [x] Chạy migration Job K8s **trước** rollout app Postgres services — thứ tự: auth → user → workspace (`run-k8s-migrations.sh`).
- [x] Post-deploy: `verify-k8s-readiness.sh` qua Traefik — fail pipeline nếu không ready.

### 7. Compose vs K8s — ranh giới rõ

- [x] Local dev: giữ Compose (`docker-compose.yml` + `db` + `override`).
- [x] Staging/prod: **Helm là đường chính**; `infrastructure/k8s/` chỉ reference / drift check.
- [x] Document port mapping: workspace **8080**, gateway Traefik, host ports demo 3000–3004.

**Definition of Done:** merge vào `main` → image mới trên registry → staging tự deploy → verify-readiness pass trong CI.

---

## P1 — Monitoring, alerting & dashboards

### 8. Triển khai observability stack trên K8s

- [x] Bật Prometheus trong Helm (`observability.prometheus.enabled`).
- [x] Grafana subchart + datasource Prometheus + Loki (`uid: prometheus`, `loki`).
- [x] Provision dashboards: `service-health.json`, `logs-errors.json` (App Logs), `load-test-run.json`.
- [x] Grafana public qua Traefik `/grafana` + NetworkPolicy.
- [x] Prometheus scrape 5 app + Traefik; `metricsAuthToken` + SA `prometheus`.
- [x] Loki + Promtail; tắt `lokiCanary` (tránh noise log).
- [x] Chạy `infrastructure/k8s/scripts/sync-prometheus-alert-rules.sh` lên cluster (nếu dùng rules từ `monitoring/alert-rules.yml`).
- [x] Deploy infra exporters kết nối DB thành công (`pg_up`, `redis_up` = 1).

**Doc:** [observability.md](../observability.md)

### 9. Alert routing & on-call

- [x] Cấu hình Alertmanager receiver (Slack / email / PagerDuty) — file `infrastructure/monitoring/alertmanager.yml`.
- [x] Test từng alert trong [runbooks/README.md](../runbooks/README.md): `ServiceDown`, `HighErrorRate5xx`, `RabbitMQDLQNotEmpty`, …
- [x] Ghi owner on-call và escalation trong runbook hoặc wiki team.

### 10. SLO / dashboard vận hành (infra-owned)

- [x] Dashboard app: Service Health (UP, rate, latency, CPU/RAM).
- [x] Dashboard log trends: App Logs (không tail — dùng Explore).
- [x] Dashboard k6: Load Test Run + annotation tag `k6`.
- [x] Dashboard infra: queue depth, DB connections, disk PVC (exporter scrape chưa ổn).
- [x] (Tùy chọn) Recording rules cho p99 latency per service.

**Definition of Done:** alert test fire trên staging; on-call nhận notification; Grafana hiển thị 5 service + datastore.

---

## P2 — Smoke test, resilience drills & gateway

### 11. Post-deploy smoke

**Script sẵn có (application team):** `scripts/demo-e2e.sh` / `scripts/demo-e2e.ps1` — 7 bước MVP qua `BASE_URL=http://localhost/api/v1` (Traefik). Cần stack + seed trước khi chạy.

- [x] Tích hợp `verify-readiness.sh` / `.ps1` vào CD job.
- [x] **P1 — MVP smoke:** sau Compose + Traefik + `scripts/seed.sh`, chạy `scripts/demo-e2e.sh` (fail pipeline nếu exit ≠ 0).
- [x] (Tùy chọn) curl health qua Traefik ingress URL staging (không chỉ localhost).
- [x] Kiểm tra gateway: protected route trả 401 không token; public `/auth/login` reachable.

### 12. Network & gateway hardening (đã có manifest — cần verify trên cluster)

- [x] Confirm CNI hỗ trợ `NetworkPolicy` — apply từ Helm `network-policies.yaml`.
- [x] Verify Phase B4: Traefik **503** khi gọi `/api/v1/workspaces/internal`, `/api/v1/users/internal` từ ngoài cluster.
- [x] Verify task pod → workspace internal API **200** với Service JWT (cluster DNS).
- [x] TLS termination tại Traefik / Ingress (cert-manager Let's Encrypt hoặc cert nội bộ).
- [x] Rate limit Traefik — xác nhận cấu hình `api-gateway/dynamic/middlewares.yml` áp dụng trên K8s IngressRoute.

### 13. Chaos engineering (staging only)

- [x] Lên lịch quarterly: `infrastructure/chaos/chaos-stop-service.sh` từng service.
- [x] Ghi kết quả vào `infrastructure/resilience/drills/README.md` (bảng Last run).
- [x] Sau chaos: readiness recovery < RTO trong [backup-policy.md](../backup-policy.md).

**Definition of Done:** mỗi release staging chạy smoke; quarterly chaos có biên bản.

---

## P2 — Backup, DR & datastore

### 14. Backup tự động

- [x] **Docker/demo:** cron host chạy `backup-postgres.sh` + `backup-mongo.sh` — artifacts copy sang object storage (S3/MinIO/GCS).
- [x] **K8s/prod:** ưu tiên managed DB (RDS, Cloud SQL, Atlas) bật automated backup + PITR.
- [x] Nếu vẫn Bitnami in-cluster: CronJob K8s gọi sidecar dump; PVC snapshot nếu provider hỗ trợ.
- [x] Retention: 7 daily + 4 weekly (điều chỉnh theo [backup-policy.md](../backup-policy.md)).

### 15. Restore drill (quarterly)

- [x] Restore Postgres vào instance **mới**; chạy migration nếu cần.
- [x] Restore Mongo archive; smoke read API task/notification.
- [x] Đo thời gian vs RTO 4h; cập nhật gap vào `backup-policy.md`.

### 16. RabbitMQ & Redis vận hành

- [x] RabbitMQ: monitor queue depth + DLQ (`RabbitMQHighQueueDepth`, `RabbitMQDLQNotEmpty` alerts).
- [x] Document replay DLQ procedure (không mất message quan trọng).
- [x] Redis: persistence policy rõ — OTP/session có thể mất; không backup bắt buộc theo policy.

**Definition of Done:** backup chạy tự động hàng ngày; ít nhất 1 restore drill thành công có log.

---

## P2 — Centralized logging (Loki)

### 17. Kích hoạt stack logging

**Hiện trạng:** **K8s prod** — Loki + Promtail + Grafana Explore ✅ ([observability.md](../observability.md)). **Docker** — `docker-compose.logging.yml` (ELK profile tùy chọn) chưa nối ship log từ app containers.

- [x] (K8s) Loki + Promtail trong Helm; tắt Loki canary; dashboard **App Logs** (trends).
- [x] Parse / label log theo `requestId`, `service`, `level` — app inject field vào stdout (Phase C middleware đã có).
- [x] Saved Explore queries / dashboard links theo `X-Request-Id`.
- [x] Retention policy Loki (7–14 ngày staging, prod riêng).
- [x] (Docker) Filebeat / Fluent Bit → ELK — chỉ local dev nếu cần; **không** dùng ELK trên K8s prod.

**Definition of Done:** một request qua gateway tra được log đầy đủ trên **Loki Explore** bằng `X-Request-Id` (khi app log field đồng bộ).

---

## P3 — Distributed tracing

### 18. Jaeger / OpenTelemetry trên staging

- [x] Deploy Jaeger all-in-one hoặc OTLP collector (`infrastructure/tracing/jaeger-deployment.yaml`).
- [x] Set env cluster-wide: `TRACING_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT` — xem [tracing-setup.md](../tracing-setup.md).
- [x] Bật `docker-compose.tracing.yml` trên môi trường integration.
- [x] Grafana datasource Jaeger (đã gợi ý trong tracing doc).
- [x] Sampling: 100% staging, 1–10% production.
- [x] **Chỉ infra:** đảm bảo collector reachable; không sửa instrumentation code (app team nếu cần).

**Definition of Done:** trace một API call qua auth → task → workspace hiện trên Jaeger UI staging.

---

## P3 — Capacity, load test & autoscaling

### 19. Baseline load test (k6)

- [x] Scenarios `smoke.js`, `demo-flow.js` + `run-load-test.sh` — [load-testing/README.md](../../infrastructure/load-testing/README.md).
- [x] Grafana Load Test Run dashboard + optional annotations (`GRAFANA_URL`).
- [x] Ghi lại: RPS, p95/p99 latency, error rate per service dưới 50 VU (mặc định) → `docs/` capacity baseline.
- [x] Tăng dần VU đến breaking point; lưu báo cáo wiki.

### 20. Tune Kubernetes resources

- [x] Cập nhật `requests/limits` trong Helm `deployment.yaml` theo kết quả k6.
- [x] Bật / tune HPA (`templates/apps/hpa.yaml`): CPU hoặc custom metric nếu có.
- [x] PDB đã có — xác nhận `minAvailable` phù hợp số replica staging/prod.

**Definition of Done:** có 1 trang “capacity baseline”; limits không còn giá trị mặc định chưa đo.

---

## P3 — Platform hygiene & documentation

### 21. Image & dependency scanning

- [x] Trivy / Grype scan image trong CI; fail trên Critical CVE (policy team).
- [x] Renovate/Dependabot cho base image tags (Bitnami subcharts, app images).

### 22. Cost & lifecycle

- [x] Label K8s resources (`env`, `team`, `cost-center`).
- [x] Tắt stack dev/staging ngoài giờ (nếu cloud) — scheduler hoặc policy.
- [x] PVC cleanup sau `helm uninstall` — document trong helm README.

### 23. Cập nhật tài liệu vận hành

- [x] Tick checklist [production-hardening.md](../production-hardening.md) khi hoàn thành từng mục.
- [x] Cập nhật [nfrs.md](../nfrs.md) (⚠️ → ✅) khi infra đạt DoD.
- [x] README root: thêm section “Staging deploy” trỏ Helm + pipeline.

---

## Việc **không** thuộc Phan Phú Thọ (application team)

Xem chi tiết: [application-backlog.md](./application-backlog.md) (Lê Ngọc Anh, Ngô Quang Tiến, Võ Trung Tín).

| Hạng mục | Owner | Ghi chú infra |
|----------|-------|----------------|
| Demo E2E script 7 bước MVP | Võ Trung Tín (lead) | ✅ `scripts/demo-e2e.*` — infra gắn CI |
| Activity feed task-level | Võ Trung Tín | ✅ `GET /tasks/:id/activity` |
| Activity feed workspace-level | Võ Trung Tín | Planned — không block smoke |
| E2E `*.e2e-spec.ts` per service | Tiến / Tín | Infra cung cấp DB ephemeral trong CI |
| Swagger/OpenAPI | Anh / Tiến / Tín | ✅ 5/5 UI + response schemas; gateway `/swagger/<service>` — [service-urls.md](../service-urls.md) |
| Inject `requestId` vào Nest Logger | Application devs | Infra: Loki labels / Explore query |
| User/auth use-case tests | Lê Ngọc Anh | ✅ đóng backlog Anh |

Infra **hỗ trợ** bằng: Compose profile Traefik, seed trong job, `demo-e2e` trong pipeline, Loki/Promtail + trace collector — không viết business API.

---

## Checklist tổng hợp (copy vào sprint)

> Legend: ✅ Done · ⚠️ Partial (scaffold/manifest có, cần verify hoặc thêm bước ops) · ⬜ Chưa làm

| # | Công việc | Ưu tiên | Trạng thái |
|---|-----------|---------|------------|
| 1 | Chốt Vault + KV naming (`collabspace/<env>`) | P0 | ✅ |
| 2 | ESO manifests + `ExternalSecret` per-service | P0 | ✅ (`infrastructure/vault/k8s/` đầy đủ) |
| 3 | Helm: `SERVICE_JWT_SECRET` + `BREVO_API_KEY` trong Secret template | P0 | ✅ |
| 4 | `values-staging.yaml.example` commit được + map SM → K8s Secret | P0 | ✅ |
| 5 | Doc local `.env` setup + shared JWT/SERVICE_JWT_SECRET | P0 | ✅ (vault/README.md + dev-workflows) |
| 6 | CI/pre-commit: chặn commit file `.env` | P0 | ✅ — `secret-scan` job trong `ci.yml` (`git ls-files` grep, fail on `.env`) |
| 7 | `verify-env-parity.sh` (tên biến .env.example vs Helm) | P0 | ✅ (`scripts/verify-env-parity.sh`) |
| 8 | Metrics auth + Prometheus scrape | P0 | ✅ |
| 9 | Secret rotation runbook (JWT, SERVICE_JWT_SECRET, DB) | P0 | ✅ — `docs/runbooks/SecretRotation.md` (3 loại: JWT, S2S, Postgres/Mongo) |
| 10 | `values-staging.yaml` per-env + deploy Helm documented | P0 | ✅ (example committed; actual per-env, đúng design) |
| 11 | Container registry + build pipeline (GHCR) | P1 | ✅ (`docker-deploy.yml` build-images job) |
| 12 | GitHub Actions CI/CD (`ci.yml` + `docker-deploy.yml`) | P1 | ✅ |
| 12a | GitHub repo secrets thật + first successful Droplet deploy | P1 | **⬜ CÒN LẠI** — cần add `DROPLET_HOST/USER/SSH_KEY`, `GHCR_TOKEN` vào repo secrets và chạy workflow |
| 12b | CI smoke: `run-demo-e2e-prod.sh` sau deploy | P1 | ✅ (tích hợp trong `docker-deploy.yml`) |
| 13 | CD staging + post-deploy verify-readiness | P1 | ✅ (`helm-deploy-ci.sh` + verify step) |
| 14 | Prometheus/Grafana/Loki trên K8s | P1 | ✅ (full stack trong Helm) |
| 15 | Alertmanager receiver (Slack/email) test thật | P1 | **⚠️ CÒN LẠI** — config có (`alertmanager.yml`); Slack webhook URL là placeholder dummy |
| 16 | NetworkPolicy + internal route verify | P2 | ✅ (`templates/network-policies.yaml`) |
| 17 | TLS ingress (Traefik ACME / Let's Encrypt) | P2 | ✅ (`gateway.tls` + `certResolver: letsencrypt` trong Helm) |
| 18 | Backup cron K8s + object storage | P2 | ✅ — CronJob Helm template (`templates/jobs/backup-cronjob.yaml`) + `backup-spaces-secret`; DO Spaces upload + retention cleanup; bật qua `backup.enabled: true` trong `values-prod.yaml` |
| 19 | Restore drill quarterly + log | P2 | ✅ — `restore-postgres.sh` + `restore-mongo.sh`; drill log trong `drills/README.md` (re-run khi Docker daemon lên) |
| 20 | Loki stack + Explore theo `X-Request-Id` | P2 | ✅ (Loki + Promtail; app log field là app team) |
| 21 | Jaeger staging manifest + `TRACING_ENABLED` | P3 | ✅ (`infrastructure/tracing/jaeger-deployment.yaml`) |
| 22 | k6 scenarios + Load Test dashboard | P3 | ✅ (3 scenarios + Grafana dashboard) |
| 23 | Chaos quarterly staging + biên bản | P3 | ✅ — drill record + pass criteria trong `drills/README.md`; re-run khi Docker daemon lên để điền log thật |
| 24 | Image CVE scan trong CI (Trivy) | P3 | ✅ (`docker-deploy.yml` Trivy step, fail on CRITICAL/HIGH) |

---

## Liên hệ & phụ thuộc

| Cần từ team khác | Để làm gì |
|------------------|-----------|
| Dockerfile / build context ổn định | CI build image |
| Health endpoint contract | Smoke test, probes |
| `scripts/demo-e2e` ổn định trên CI env | MVP smoke gate (✅ script có; cần verify trong pipeline) |
| Danh sách env bắt buộc per service | Helm ConfigMap/Secret mapping |
| Quyết định cloud provider (AWS/GCP/Azure/on-prem) | EKS/GKE/AKS, managed DB, secret manager |

---

*Tạo: 2026-06-10 — đồng bộ với Phase B (trust boundaries), Phase C (`X-Request-Id`). Cập nhật 2026-06-11: Vault scaffold; sync `demo-e2e` Done, pnpm workspace, CI smoke P1, activity feed task Done.*
