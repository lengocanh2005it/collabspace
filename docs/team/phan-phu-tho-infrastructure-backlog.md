# Backlog hạ tầng — Phan Phú Thọ (Infrastructure Engineer)

Tài liệu này liệt kê **công việc hạ tầng / DevOps / observability / CI/CD / monitoring** cần làm tiếp để CollabSpace sẵn sàng vận hành ngoài môi trường demo local.

**Phạm vi:** chỉ infra, platform, pipeline, cluster, datastore, gateway, observability stack.  
**Ngoài phạm vi file này:** feature API, business logic, middleware trong NestJS app services (thuộc application team).

**Trạng thái repo (snapshot 2026-06-12):**

| Đã có sẵn | Chưa operational hóa / prod-ready |
|-----------|-----------------------------------|
| Docker Compose stack (`infrastructure/docker/`) | Multi-env staging/prod chuẩn hóa end-to-end |
| **pnpm workspace** — root `package.json`, `pnpm-workspace.yaml`, `packages/shared` | CI `pnpm -r run build\|test` từ root trong pipeline |
| **Demo E2E script** — `scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1` (7 bước qua Traefik) | Gắn script vào CI smoke / nightly |
| **HashiCorp Vault scaffold** (`infrastructure/vault/`) — dev Compose, KV seed/sync, ESO YAML, Helm `externalSecrets` | Vault HA deploy, K8s auth, rotation, smoke sau ESO sync |
| Helm umbrella chart (`infrastructure/helm/collabspace/`) | `values-prod.yaml` + deploy k3s lần đầu |
| **GHCR image build** — GitHub Actions `build-images` 5 service ✅ | Workflow deploy Helm/k3s (thay Compose SSH) |
| **Lộ trình deploy DO** — [deployment-k3s-phases.md](../deployment-k3s-phases.md) | Thực hiện Phase 0–5 trên Droplet thật |
| K8s manifests legacy (`infrastructure/k8s/`) — tham chiếu | Load test baseline → tune resources |
| Traefik gateway + forward-auth (`api-gateway/`) | Backup tự động + restore drill |
| Prometheus + Alertmanager + Grafana (`infrastructure/monitoring/`) | ELK/Logstash ship log từ container |
| Jaeger / OTLP (`docker-compose.tracing.yml`, `infrastructure/tracing/`) | Tracing bật trên staging/prod |
| Jenkins container + shell scripts (`infrastructure/jenkins/`), GitHub Actions CI/CD (`.github/workflows/`) | GitHub Secrets `DROPLET_*` + workflow `helm upgrade` |
| k6 load tests (`infrastructure/load-testing/`) | Chaos drill định kỳ trên staging |
| Backup scripts (`infrastructure/backup/scripts/`) | ESO installed + Vault reachable on cluster |
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
P1  Monitoring stack trên K8s       →  scrape metrics, alert, Grafana
P1  MVP smoke trong CI              →  `scripts/demo-e2e` sau Compose + Traefik (phối hợp Tín)
P2  Smoke / readiness sau deploy    →  verify-readiness + demo-e2e trong pipeline
P2  Backup tự động + restore drill  →  đáp ứng backup-policy
P2  Logging tập trung (ELK)         →  tra cứu log theo X-Request-Id
P3  Tracing staging                 →  Jaeger/OTLP + retention
P3  Load test + tune HPA/limits     →  capacity baseline
P3  Chaos quarterly (staging)       →  chứng minh recovery
```

---

## P0 — Secrets & môi trường

### 1. Chuẩn hóa môi trường

- [ ] Định nghĩa **3 tầng**: `local` (Compose), `staging` (K8s), `production` (K8s hoặc managed).
- [x] Tạo `values-prod.example.yaml` + script `prepare-prod-values` — [phase0-checklist.md](../../infrastructure/deploy/phase0-checklist.md).
- [x] Script Phase 1: `k3s-bootstrap.sh`, `verify-phase1.sh`, `fetch-kubeconfig` — [phase1-checklist.md](../../infrastructure/deploy/phase1-checklist.md).
- [x] Script Phase 2: `vault-eso-phase2.sh`, `verify-phase2.sh`, `external-secrets.prod.yaml` — [phase2-checklist.md](../../infrastructure/deploy/phase2-checklist.md).
- [x] Script Phase 3–4: `helm-deploy-phase3.sh`, `helm-deploy-ci.sh`, `helm-rollout.sh` — [phase3-checklist.md](../../infrastructure/deploy/phase3-checklist.md), [phase4-checklist.md](../../infrastructure/deploy/phase4-checklist.md).
- [ ] Chạy Phase 2 trên Droplet; backup `.vault-k3s-init.json` off-server.
- [ ] Điền `phase0.env` và chạy script trên máy ops; không commit `values-prod.yaml`.
- [ ] Chạy `k3s-bootstrap.sh` trên Droplet thật; `verify-phase1.sh` pass.
- [ ] Tạo `values-staging.yaml` nếu cần môi trường staging riêng.
- [ ] Document biến bắt buộc từ [production-hardening.md](../production-hardening.md#secrets-reference-never-commit-real-values).
- [ ] Đồng bộ `INTERNAL_SERVICE_TOKEN`, `JWT_SECRET`, DB passwords giữa các service trong cùng môi trường (Compose `.env` vs Helm `global.secrets`).

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
| **Secret** | `JWT_SECRET`, `POSTGRES_PASSWORD`, `MAIL_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING` | Vault KV → ESO → K8s `Secret` | ❌ |
| **Config** | `PORT`, `GRPC_URL`, `RABBITMQ_QUEUE`, timeout ms, feature flags | Helm `ConfigMap` / `values.yaml` | ✅ |
| **Connection string lẫn secret** | `DATABASE_URL`, `MONGO_URI`, `RABBITMQ_URL`, `REDIS_URL` | Build từ template + password từ Secret (Helm helper hiện có) | URL template ✅; password ❌ |

**Shared secrets — phải cùng giá trị mọi service trong một môi trường**

| Biến | Services dùng | Ghi chú |
|------|---------------|---------|
| `JWT_SECRET` | auth (ký token), user/workspace/task/notification (verify qua gRPC — auth giữ private key) | Chỉ auth cần trong `.env` local; các service khác verify qua gRPC, không cần duplicate trừ khi app đọc trực tiếp |
| `INTERNAL_SERVICE_TOKEN` | user, workspace (inbound), task, notification (outbound S2S) | **Cùng một chuỗi** — xem [docker/.env.example](../../infrastructure/docker/.env.example) |
| `POSTGRES_PASSWORD` | auth, user, workspace + Bitnami postgres subchart | Khớp `global.secrets.postgresPassword` |
| `mongoPassword` | task, notification + Bitnami mongo | Khớp `global.secrets.mongoPassword` |
| `rabbitmqPassword` | tất cả publisher/consumer + Bitnami rabbitmq | Khớp `global.secrets.rabbitmqPassword` |
| `redisPassword` | auth, notification + Bitnami redis | Khớp `global.secrets.redisPassword` |
| `METRICS_AUTH_TOKEN` | 5 app services + Prometheus scrape | Cùng token |

**Luồng đề xuất theo môi trường**

```text
LOCAL (developer)
  services/*/.env.example  ──copy──►  services/*/.env  (gitignored)
  infrastructure/docker/.env.example  ──►  shared JWT + INTERNAL_SERVICE_TOKEN đồng bộ tay

LOCAL (Vault optional)
  docker-compose.vault.yml  →  seed-dev-secrets  →  sync-env-from-vault  →  services/*/.env

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
| Rotation / drill | 📋 | `INTERNAL_SERVICE_TOKEN`, `JWT_SECRET` dual-key |

#### 2.1 Inventory biến theo service (từ `.env.example`)

Dùng bảng này khi seed Vault KV (`secret/collabspace/staging`, …).

| Service | Secret (đưa vào SM) | Config (Helm ConfigMap / values) |
|---------|---------------------|----------------------------------|
| **auth-service** | `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `MAIL_USER`, `MAIL_PASSWORD`, `METRICS_AUTH_TOKEN` | `PORT`, `GRPC_*`, `RABBITMQ_QUEUE`, OTP TTL, outbox tuning, `TRACING_*` |
| **user-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `AUTH_SERVICE_GRPC_URL`, `GRPC_URL`, `DATABASE_SCHEMA` |
| **workspace-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `PORT=8080`, `AUTH_SERVICE_GRPC_URL`, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **task-service** | `MONGO_URI` (hoặc password riêng + template URI), `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING`, `METRICS_AUTH_TOKEN` | `WORKSPACE_SERVICE_URL`, `USER_SERVICE_URL`, outbox, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **notification-service** | `JWT_SECRET` (nếu service đọc — hiện verify gRPC), `MONGO_URI`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `USER_SERVICE_URL`, `RABBITMQ_QUEUE` |
| **rabbitmq** (infra) | `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` | vhost `collabspace` |
| **Compose / Helm datastores** | Bitnami `postgresPassword`, `mongoPassword`, `redisPassword`, `rabbitmqPassword` | hostnames: `postgres`, `mongo`, `redis`, `rabbitmq` |

#### 2.2 Công việc triển khai HashiCorp Vault + ESO

- [x] **Chốt provider:** HashiCorp Vault + External Secrets Operator — [vault/README.md](../../infrastructure/vault/README.md).
- [x] **Naming convention KV v2:** `secret/collabspace/<env>` — keys: `jwt_secret`, `internal_service_token`, `postgres_password`, `mongo_*`, `redis_password`, `rabbitmq_*`, `metrics_auth_token`.
- [x] Scaffold local: `docker-compose.vault.yml`, `seed-dev-secrets`, `sync-env-from-vault`.
- [x] Manifest ESO: `infrastructure/vault/k8s/external-secrets.yaml` → per-app `{app}-secrets`.
- [x] Helm: `global.externalSecrets.enabled`, `global.secrets.internalServiceToken` trong [secret.yaml](../../infrastructure/helm/collabspace/templates/apps/secret.yaml).
- [ ] Cài **External Secrets Operator** trên cluster staging thật.
- [ ] Deploy **Vault HA** + Kubernetes auth (không root token prod).
- [ ] **Bổ sung gap:** `MAIL_*` cho auth email outbox trong Vault + ExternalSecret.
- [ ] Tạo `values-staging.yaml.example` (commit được): `externalSecrets.enabled: true`, không giá trị secret.
- [ ] Staging/prod: tắt render Helm `stringData` — chỉ ESO (`externalSecrets.enabled: true`).

#### 2.3 Quy trình `.env` cho developer (local)

- [x] Document local env + Vault: [vault/README.md](../../infrastructure/vault/README.md), [development-workflows.md](../../.claude/docs/development-workflows.md), [README.md](../../README.md) Quick Start.
  1. **Option A:** `cp services/*/.env.example` → `.env`; đồng bộ `JWT_SECRET` + `INTERNAL_SERVICE_TOKEN` theo [docker/.env.example](../../infrastructure/docker/.env.example).
  2. **Option B (Vault):** `docker-compose.vault.yml` → `seed-dev-secrets` → `sync-env-from-vault`.
  3. `ALLOW_DEV_IDENTITY_HEADERS=true` chỉ local; **không** bật staging/prod.
- [ ] Pre-commit hoặc CI grep: **fail** nếu commit file `.env` (không `.env.example`).
- [ ] `.gitignore` đã ignore `.env` — xác nhận không có exception.

#### 2.4 Quy trình staging / production

- [ ] **Không** mount file `.env` vào container prod; chỉ `env` từ K8s Secret/ConfigMap.
- [ ] CD pipeline: không `echo $SECRET >> .env`; dùng `helm upgrade` + ESO đã sync hoặc `helm secrets` (SOPS).
- [ ] **Rotation** (lịch 90 ngày hoặc khi lộ):
  1. Tạo giá trị mới trong SM.
  2. Rolling restart từng tier (datastore password cần đổi Bitnami + connection string đồng bộ).
  3. `JWT_SECRET` rotate = invalidate toàn bộ access token — thông báo maintenance hoặc chỉ staging.
  4. `INTERNAL_SERVICE_TOKEN` rotate = deploy đồng thời user/workspace/task/notification.
- [ ] Audit: bật CloudTrail / SM access log; ai đọc secret staging/prod.

#### 2.5 Đồng bộ Compose ↔ Helm ↔ Secret Manager

| Giá trị | Local Compose | Helm `global.secrets` | Vault KV key (`secret/collabspace/<env>`) |
|---------|---------------|----------------------|-------------------------------------------|
| JWT | `auth-service/.env` | `jwtSecret` | `jwt_secret` |
| Internal S2S | 4 service `.env` | `internalServiceToken` | `internal_service_token` |
| Postgres | URL trong `.env` | `postgresPassword` | `postgres_password` |
| Mongo | `MONGO_URI` | `mongoPassword` | `mongo_username`, `mongo_password` |
| Redis | `REDIS_PASSWORD` | `redisPassword` | `redis_password` |
| RabbitMQ | URL trong `.env` | `rabbitmqPassword` | `rabbitmq_username`, `rabbitmq_password` |
| Metrics | `METRICS_AUTH_TOKEN` | `metricsAuthToken` | `metrics_auth_token` |
| SMTP | `MAIL_*` auth | *(gap)* | *(gap — chưa trong Vault seed)* |

- [ ] Script kiểm tra (infra): `scripts/verify-env-parity.sh` — so sánh tên biến trong tất cả `.env.example` vs Helm ConfigMap/Secret keys (không in giá trị).

**Definition of Done (Vault + ESO):**

- Staging: không file `.env` trên server; `kubectl describe pod` không lộ secret trong annotation.
- Một lệnh rotate trên SM → ESO sync → rolling restart → `verify-readiness` pass.
- Dev mới onboard: đọc 1 doc + có `.env` local trong 15 phút (hoặc Doppler login).

### 3. Metrics endpoint lockdown (infra layer)

- [ ] Set `global.secrets.metricsAuthToken` trên staging/prod.
- [ ] Cấu hình Prometheus scrape với `bearer_token` hoặc header `X-Metrics-Token` (Helm `observability/prometheus.yaml`).
- [ ] NetworkPolicy / ingress: **không** expose `/metrics` ra internet; chỉ Prometheus trong cluster scrape được.
- [ ] Xác nhận alert rules vẫn fire khi service down (không bị 401 che mất signal).

**Definition of Done:** staging deploy bằng Helm mà không có secret trong Git; `kubectl get secret` nguồn từ operator; Prometheus scrape 5 service thành công với auth.

---

## P1 — CI/CD & container supply chain

### 4. Image build & registry

- [ ] Chọn registry (GHCR, Docker Hub org, ECR, ACR, GCR).
- [ ] Build & push image cho 5 app services + workspace (port 8080 trong image CMD).
- [ ] Tag strategy: `main` → `latest-staging`; git tag `v*` → `v1.2.3` prod.
- [ ] Cập nhật Helm `apps.*.image.repository` / `tag` theo registry thật.

### 5. Pipeline CI (chọn một hoặc cả hai)

**Hiện trạng:** `infrastructure/docker/docker-compose.jenkins.yml` + scripts `build.sh`, `test.sh`, `deploy.sh`; GitHub Actions workflows exist for root CI and GHCR/Droplet deploy (`.github/workflows/ci.yml`, `.github/workflows/docker-deploy.yml`).

- [ ] **Option A — Jenkins:** Jenkinsfile multibranch:
  1. `pnpm install` tại repo root → `pnpm run build` + `pnpm run test` (`package.json` workspace).
  2. Lint per service nếu cần (`pnpm -r run lint`).
  3. Build Docker image khi merge `main` / tag release.
  4. Push registry.
  5. Trigger deploy staging (Helm upgrade).
- [x] **Option B — GitHub Actions:** root CI + GHCR image build 5 service ✅.
- [x] Docker image build fix (shared node_modules, seed.ts exclude) — 2026-06-12.
- [x] Workflow deploy **k3s/Helm** (`docker-deploy.yml` → `helm-deploy-ci.sh` + `verify-k8s-readiness.sh`) — [phase4-checklist.md](../../infrastructure/deploy/phase4-checklist.md).
- [ ] Thêm GitHub Actions secrets (`DROPLET_*`, `GHCR_*`) và chạy deploy lần đầu theo [deployment-k3s-phases.md](../deployment-k3s-phases.md).
- [ ] Cache `pnpm` / Docker layer để pipeline < 15 phút (mục tiêu ban đầu).
- [ ] Branch protection: PR bắt buộc pass test trước merge.

### 6. Pipeline CD (deploy)

- [ ] Staging: `helm upgrade --install` sau CI success trên `main`.
- [ ] Production: manual approval hoặc tag-only deploy.
- [x] Chạy migration Job K8s **trước** rollout app Postgres services — thứ tự: auth → user → workspace (`run-k8s-migrations.sh`).
- [x] Post-deploy: `verify-k8s-readiness.sh` qua Traefik — fail pipeline nếu không ready.

### 7. Compose vs K8s — ranh giới rõ

- [ ] Local dev: giữ Compose (`docker-compose.yml` + `db` + `override`).
- [ ] Staging/prod: **Helm là đường chính**; `infrastructure/k8s/` chỉ reference / drift check.
- [ ] Document port mapping: workspace **8080**, gateway Traefik, host ports demo 3000–3004.

**Definition of Done:** merge vào `main` → image mới trên registry → staging tự deploy → verify-readiness pass trong CI.

---

## P1 — Monitoring, alerting & dashboards

### 8. Triển khai observability stack trên K8s

- [ ] Bật Prometheus trong Helm (`observability` — hiện tắt ở `values-local.yaml`).
- [ ] Apply Grafana + datasource Prometheus (`infrastructure/monitoring/grafana-deployment.yaml` hoặc subchart).
- [ ] Chạy `infrastructure/k8s/scripts/sync-prometheus-alert-rules.sh` (hoặc `.ps1`) lên cluster đích.
- [ ] Xác nhận Grafana datasource UID `prometheus` khớp dashboard JSON đã commit.
- [ ] Deploy infra exporters: `exporters-deployment.yaml` / `docker-compose.exporters.yml` (Postgres, Redis, Mongo, RabbitMQ).

### 9. Alert routing & on-call

- [ ] Cấu hình Alertmanager receiver (Slack / email / PagerDuty) — file `infrastructure/monitoring/alertmanager.yml`.
- [ ] Test từng alert trong [runbooks/README.md](../runbooks/README.md): `ServiceDown`, `HighErrorRate5xx`, `RabbitMQDLQNotEmpty`, …
- [ ] Ghi owner on-call và escalation trong runbook hoặc wiki team.

### 10. SLO / dashboard vận hành (infra-owned)

- [ ] Dashboard tổng: uptime readiness, HTTP rate/error/latency (đã có metric từ app).
- [ ] Dashboard infra: queue depth, DB connections, disk PVC, pod restart rate.
- [ ] (Tùy chọn) Recording rules cho p99 latency per service.

**Definition of Done:** alert test fire trên staging; on-call nhận notification; Grafana hiển thị 5 service + datastore.

---

## P2 — Smoke test, resilience drills & gateway

### 11. Post-deploy smoke

**Script sẵn có (application team):** `scripts/demo-e2e.sh` / `scripts/demo-e2e.ps1` — 7 bước MVP qua `BASE_URL=http://localhost/api/v1` (Traefik). Cần stack + seed trước khi chạy.

- [ ] Tích hợp `verify-readiness.sh` / `.ps1` vào CD job.
- [ ] **P1 — MVP smoke:** sau Compose + Traefik + `scripts/seed.sh`, chạy `scripts/demo-e2e.sh` (fail pipeline nếu exit ≠ 0).
- [ ] (Tùy chọn) curl health qua Traefik ingress URL staging (không chỉ localhost).
- [ ] Kiểm tra gateway: protected route trả 401 không token; public `/auth/login` reachable.

### 12. Network & gateway hardening (đã có manifest — cần verify trên cluster)

- [ ] Confirm CNI hỗ trợ `NetworkPolicy` — apply từ Helm `network-policies.yaml`.
- [ ] Verify Phase B4: Traefik **503** khi gọi `/api/v1/workspaces/internal`, `/api/v1/users/internal` từ ngoài cluster.
- [ ] Verify task pod → workspace internal API **200** với `X-Internal-Service-Token` (cluster DNS).
- [ ] TLS termination tại Traefik / Ingress (cert-manager Let's Encrypt hoặc cert nội bộ).
- [ ] Rate limit Traefik — xác nhận cấu hình `api-gateway/dynamic/middlewares.yml` áp dụng trên K8s IngressRoute.

### 13. Chaos engineering (staging only)

- [ ] Lên lịch quarterly: `infrastructure/chaos/chaos-stop-service.sh` từng service.
- [ ] Ghi kết quả vào `infrastructure/resilience/drills/README.md` (bảng Last run).
- [ ] Sau chaos: readiness recovery < RTO trong [backup-policy.md](../backup-policy.md).

**Definition of Done:** mỗi release staging chạy smoke; quarterly chaos có biên bản.

---

## P2 — Backup, DR & datastore

### 14. Backup tự động

- [ ] **Docker/demo:** cron host chạy `backup-postgres.sh` + `backup-mongo.sh` — artifacts copy sang object storage (S3/MinIO/GCS).
- [ ] **K8s/prod:** ưu tiên managed DB (RDS, Cloud SQL, Atlas) bật automated backup + PITR.
- [ ] Nếu vẫn Bitnami in-cluster: CronJob K8s gọi sidecar dump; PVC snapshot nếu provider hỗ trợ.
- [ ] Retention: 7 daily + 4 weekly (điều chỉnh theo [backup-policy.md](../backup-policy.md)).

### 15. Restore drill (quarterly)

- [ ] Restore Postgres vào instance **mới**; chạy migration nếu cần.
- [ ] Restore Mongo archive; smoke read API task/notification.
- [ ] Đo thời gian vs RTO 4h; cập nhật gap vào `backup-policy.md`.

### 16. RabbitMQ & Redis vận hành

- [ ] RabbitMQ: monitor queue depth + DLQ (`RabbitMQHighQueueDepth`, `RabbitMQDLQNotEmpty` alerts).
- [ ] Document replay DLQ procedure (không mất message quan trọng).
- [ ] Redis: persistence policy rõ — OTP/session có thể mất; không backup bắt buộc theo policy.

**Definition of Done:** backup chạy tự động hàng ngày; ít nhất 1 restore drill thành công có log.

---

## P2 — Centralized logging (ELK)

### 17. Kích hoạt stack logging

**Hiện trạng:** `docker-compose.logging.yml` (Elasticsearch, Logstash, Kibana) — chưa nối ship log từ app containers.

- [ ] Chọn agent: Filebeat / Fluent Bit / Docker logging driver → Logstash `5044`.
- [ ] Parse JSON log hoặc prefix `[requestId]` — app đã propagate `X-Request-Id` (Phase C); infra cần **thu thập** field đó từ stdout.
- [ ] Kibana index pattern + saved search theo `requestId`, `service`, `level`.
- [ ] Retention index (ILM): 7–14 ngày staging, policy prod riêng.
- [ ] (K8s) EFK/Loki thay ELK nếu team chuẩn hóa Grafana Loki — quyết định một stack.

**Definition of Done:** một request qua gateway tra được log đầy đủ trên Kibana/Loki bằng `X-Request-Id`.

---

## P3 — Distributed tracing

### 18. Jaeger / OpenTelemetry trên staging

- [ ] Deploy Jaeger all-in-one hoặc OTLP collector (`infrastructure/tracing/jaeger-deployment.yaml`).
- [ ] Set env cluster-wide: `TRACING_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT` — xem [tracing-setup.md](../tracing-setup.md).
- [ ] Bật `docker-compose.tracing.yml` trên môi trường integration.
- [ ] Grafana datasource Jaeger (đã gợi ý trong tracing doc).
- [ ] Sampling: 100% staging, 1–10% production.
- [ ] **Chỉ infra:** đảm bảo collector reachable; không sửa instrumentation code (app team nếu cần).

**Definition of Done:** trace một API call qua auth → task → workspace hiện trên Jaeger UI staging.

---

## P3 — Capacity, load test & autoscaling

### 19. Baseline load test (k6)

- [ ] Chạy `infrastructure/load-testing/run-load-test.sh` với `.env` từ `k6/.env.example`.
- [ ] Ghi lại: RPS, p95/p99 latency, error rate per service dưới 50 VU (mặc định).
- [ ] Tăng dần VU đến breaking point; lưu báo cáo `docs/` hoặc wiki.

### 20. Tune Kubernetes resources

- [ ] Cập nhật `requests/limits` trong Helm `deployment.yaml` theo kết quả k6.
- [ ] Bật / tune HPA (`templates/apps/hpa.yaml`): CPU hoặc custom metric nếu có.
- [ ] PDB đã có — xác nhận `minAvailable` phù hợp số replica staging/prod.

**Definition of Done:** có 1 trang “capacity baseline”; limits không còn giá trị mặc định chưa đo.

---

## P3 — Platform hygiene & documentation

### 21. Image & dependency scanning

- [ ] Trivy / Grype scan image trong CI; fail trên Critical CVE (policy team).
- [ ] Renovate/Dependabot cho base image tags (Jenkins, Bitnami subcharts).

### 22. Cost & lifecycle

- [ ] Label K8s resources (`env`, `team`, `cost-center`).
- [ ] Tắt stack dev/staging ngoài giờ (nếu cloud) — scheduler hoặc policy.
- [ ] PVC cleanup sau `helm uninstall` — document trong helm README.

### 23. Cập nhật tài liệu vận hành

- [ ] Tick checklist [production-hardening.md](../production-hardening.md) khi hoàn thành từng mục.
- [ ] Cập nhật [nfrs.md](../nfrs.md) (⚠️ → ✅) khi infra đạt DoD.
- [ ] README root: thêm section “Staging deploy” trỏ Helm + pipeline.

---

## Việc **không** thuộc Phan Phú Thọ (application team)

Xem chi tiết: [application-backlog.md](./application-backlog.md) (Lê Ngọc Anh, Ngô Quang Tiến, Võ Trung Tín).

| Hạng mục | Owner | Ghi chú infra |
|----------|-------|----------------|
| Demo E2E script 7 bước MVP | Võ Trung Tín (lead) | ✅ `scripts/demo-e2e.*` — infra gắn CI |
| Activity feed task-level | Võ Trung Tín | ✅ `GET /tasks/:id/activity` |
| Activity feed workspace-level | Võ Trung Tín | Planned — không block smoke |
| E2E `*.e2e-spec.ts` per service | Tiến / Tín | Infra cung cấp DB ephemeral trong CI |
| Swagger/OpenAPI | Anh / Tiến / Tín | ✅ 5/5 tại `/swagger` |
| Inject `requestId` vào Nest Logger | Application devs | Infra: ELK parse field |
| User/auth use-case tests | Lê Ngọc Anh | ✅ đóng backlog Anh |

Infra **hỗ trợ** bằng: Compose profile Traefik, seed trong job, `demo-e2e` trong pipeline, ELK/trace collector — không viết business API.

---

## Checklist tổng hợp (copy vào sprint)

| # | Công việc | Ưu tiên | Trạng thái |
|---|-----------|---------|------------|
| 1 | Chốt Vault + KV naming (`collabspace/<env>`) | P0 | ✅ scaffold |
| 2 | ESO cài trên cluster + `ExternalSecret` staging live | P0 | ⬜ (YAML có sẵn) |
| 3 | Helm: thêm `INTERNAL_SERVICE_TOKEN` + `MAIL_*` vào Secret template | P0 | ⬜ |
| 4 | `values-staging.yaml.example` + map SM → K8s Secret | P0 | ⬜ |
| 5 | Doc local `.env` setup + shared JWT/INTERNAL token | P0 | ⬜ |
| 6 | CI/pre-commit: chặn commit file `.env` | P0 | ⬜ |
| 7 | `verify-env-parity.sh` (tên biến .env.example vs Helm) | P0 | ⬜ |
| 8 | Metrics auth + Prometheus scrape | P0 | ⬜ |
| 9 | Secret rotation runbook (JWT, INTERNAL, DB) | P0 | ⬜ |
| 10 | `values-staging.yaml` + deploy Helm document | P0 | ⬜ |
| 11 | Container registry + build pipeline | P1 | ⬜ |
| 12 | Jenkinsfile hoặc GitHub Actions CI/CD (`pnpm -r` từ root) | P1 | ✅ scaffold |
| 12a | Add real GitHub Actions secrets + first successful Droplet deploy | P1 | ⬜ |
| 12b | CI smoke: `scripts/demo-e2e` sau Traefik + seed | P1 | ⬜ |
| 13 | CD staging + post-deploy verify-readiness | P1 | ⬜ |
| 14 | Prometheus/Grafana/Alertmanager trên K8s | P1 | ⬜ |
| 15 | Alertmanager → Slack/email test | P1 | ⬜ |
| 16 | NetworkPolicy + internal route verify | P2 | ⬜ |
| 17 | TLS ingress (cert-manager) | P2 | ⬜ |
| 18 | Backup cron + object storage | P2 | ⬜ |
| 19 | Restore drill quarterly | P2 | ⬜ |
| 20 | Filebeat/Fluent Bit → ELK | P2 | ⬜ |
| 21 | Jaeger staging + TRACING_ENABLED | P3 | ⬜ |
| 22 | k6 baseline + tune requests/limits | P3 | ⬜ |
| 23 | Chaos quarterly staging | P3 | ⬜ |
| 24 | Image CVE scan trong CI | P3 | ⬜ |

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
