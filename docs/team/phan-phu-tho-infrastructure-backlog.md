# Backlog hạ tầng — Phan Phú Thọ (Infrastructure Engineer)

Tài liệu này liệt kê **công việc hạ tầng / DevOps / observability / CI/CD / monitoring** cần làm tiếp để CollabSpace sẵn sàng vận hành ngoài môi trường demo local.

**Phạm vi:** chỉ infra, platform, pipeline, cluster, datastore, gateway, observability stack.  
**Ngoài phạm vi file này:** feature API, business logic, middleware trong NestJS app services (thuộc application team).

**Trạng thái repo (snapshot 2026-06):**

| Đã có sẵn | Chưa operational hóa / prod-ready |
|-----------|-----------------------------------|
| Docker Compose stack (`infrastructure/docker/`) | Secrets thật, multi-env chuẩn hóa |
| Helm umbrella chart (`infrastructure/helm/collabspace/`) | CI/CD end-to-end, image registry |
| K8s manifests legacy (`infrastructure/k8s/`) — tham chiếu | Load test baseline → tune resources |
| Traefik gateway + forward-auth (`api-gateway/`) | Backup tự động + restore drill |
| Prometheus + Alertmanager + Grafana (`infrastructure/monitoring/`) | ELK/Logstash ship log từ container |
| Jaeger / OTLP (`docker-compose.tracing.yml`, `infrastructure/tracing/`) | Tracing bật trên staging/prod |
| Jenkins container + shell scripts (`infrastructure/jenkins/`) | Pipeline Jenkinsfile / GitHub Actions |
| k6 load tests (`infrastructure/load-testing/`) | Chaos drill định kỳ trên staging |
| Backup scripts (`infrastructure/backup/scripts/`) | External Secrets / Sealed Secrets |
| Drills (`verify-readiness`, `chaos-stop-service`) | Smoke job sau mỗi deploy |

**Tài liệu liên quan:**

- [production-hardening.md](../production-hardening.md)
- [nfrs.md](../nfrs.md)
- [backup-policy.md](../backup-policy.md)
- [resilience-overview.md](../resilience-overview.md)
- [tracing-setup.md](../tracing-setup.md)
- [runbooks/README.md](../runbooks/README.md)
- [infrastructure/helm/README.md](../../infrastructure/helm/README.md)
- [infrastructure/k8s/README.md](../../infrastructure/k8s/README.md)
- [infrastructure/docker/.env.example](../../infrastructure/docker/.env.example) — shared dev secrets (Compose)
- Per-service contract: `services/*/.env.example` (gitignored `.env` thật)

---

## Thứ tự ưu tiên đề xuất

```text
P0  Secret Manager + .env chuẩn hóa   →  không commit secret; đồng bộ cross-service
P0  Secrets + môi trường staging     →  deploy an toàn, không lộ credential
P1  CI/CD + image registry          →  build/test/deploy lặp lại được
P1  Monitoring stack trên K8s       →  scrape metrics, alert, Grafana
P2  Smoke / readiness sau deploy    →  verify-readiness trong pipeline
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
- [ ] Tạo `values-staging.yaml` / `values-prod.yaml` **mẫu** (không commit secret) — tham chiếu [helm/README.md](../../infrastructure/helm/README.md).
- [ ] Document biến bắt buộc từ [production-hardening.md](../production-hardening.md#secrets-reference-never-commit-real-values).
- [ ] Đồng bộ `INTERNAL_SERVICE_TOKEN`, `JWT_SECRET`, DB passwords giữa các service trong cùng môi trường (Compose `.env` vs Helm `global.secrets`).

### 2. Secret Manager & quản lý giá trị `.env`

**Nguyên tắc**

| Quy tắc | Chi tiết |
|---------|----------|
| **Contract trong Git** | Chỉ `*.env.example` — tên biến, giá trị mẫu, comment; **không** giá trị prod/staging thật |
| **Giá trị thật** | Secret Manager / vault / Sealed Secret / CI secret store |
| **Local dev** | File `.env` trên máy dev (gitignored); copy từ `.env.example` hoặc lấy từ vault dev |
| **Một nguồn sự thật** | Staging/prod: secret store → K8s `Secret` (hoặc ESO sync); không copy tay nhiều file |

**Phân loại biến (áp dụng cho mọi service)**

| Loại | Ví dụ | Lưu ở đâu (staging/prod) | Trong Git? |
|------|-------|---------------------------|------------|
| **Secret** | `JWT_SECRET`, `POSTGRES_PASSWORD`, `MAIL_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING` | Secret Manager → K8s `Secret` | ❌ |
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

STAGING / PROD (Phan Phú Thọ)
  Secret Manager (1 secret JSON hoặc key/value per env)
       │
       ▼  External Secrets Operator (sync mỗi 1–5 phút hoặc on-deploy)
  K8s Secret: collabspace-shared-secrets + per-app secrets
       │
       ▼  envFrom / secretKeyRef
  Pod: auth-service, user-service, …

CONFIG (không nhạy cảm)
  Helm values-staging.yaml  ──►  ConfigMap *-config  (templates/apps/configmap.yaml)
```

**Chọn công cụ Secret Manager (chọn 1 stack chính)**

| Công cụ | Phù hợp khi | Ghi chú |
|---------|-------------|---------|
| **AWS Secrets Manager** + ESO | Deploy EKS | IAM role cho pod; rotation native |
| **GCP Secret Manager** + ESO | Deploy GKE | Tương tự workload identity |
| **Azure Key Vault** + ESO | Deploy AKS | Service principal / managed identity |
| **HashiCorp Vault** | On-prem / multi-cloud | Linh hoạt; vận hành nặng hơn |
| **Doppler** / **1Password Secrets Automation** | Team nhỏ, cần UI + CLI dev | Sync CLI `doppler run -- docker compose up`; có K8s operator |
| **Sealed Secrets** | Không có cloud SM; GitOps | Secret mã hóa commit được; rotate thủ công |
| **SOPS + age** | Helm values mã hóa trong repo | Bitnami/Flux pattern |
| **GitHub Environments secrets** | Chỉ inject lúc CD | Không thay SM runtime; dùng kèm `helm --set` |

**Đề xuất cho CollabSpace demo → staging:**  
Cloud SM + **External Secrets Operator** (nếu có cloud) **hoặc** **Doppler** (nhanh cho team học) **hoặc** **Sealed Secrets** (on-prem/minikube).

#### 2.1 Inventory biến theo service (từ `.env.example`)

Dùng bảng này khi tạo secret JSON trong Secret Manager (`collabspace/staging/...`).

| Service | Secret (đưa vào SM) | Config (Helm ConfigMap / values) |
|---------|---------------------|----------------------------------|
| **auth-service** | `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `MAIL_USER`, `MAIL_PASSWORD`, `METRICS_AUTH_TOKEN` | `PORT`, `GRPC_*`, `RABBITMQ_QUEUE`, OTP TTL, outbox tuning, `TRACING_*` |
| **user-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `AUTH_SERVICE_GRPC_URL`, `GRPC_URL`, `DATABASE_SCHEMA` |
| **workspace-service** | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `PORT=8080`, `AUTH_SERVICE_GRPC_URL`, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **task-service** | `MONGO_URI` (hoặc password riêng + template URI), `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `AZURE_STORAGE_CONNECTION_STRING`, `METRICS_AUTH_TOKEN` | `WORKSPACE_SERVICE_URL`, `USER_SERVICE_URL`, outbox, `ALLOW_DEV_IDENTITY_HEADERS=false` |
| **notification-service** | `JWT_SECRET` (nếu service đọc — hiện verify gRPC), `MONGO_URI`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN` | `USER_SERVICE_URL`, `RABBITMQ_QUEUE` |
| **rabbitmq** (infra) | `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` | vhost `collabspace` |
| **Compose / Helm datastores** | Bitnami `postgresPassword`, `mongoPassword`, `redisPassword`, `rabbitmqPassword` | hostnames: `postgres`, `mongo`, `redis`, `rabbitmq` |

#### 2.2 Công việc triển khai Secret Manager

- [ ] **Chốt provider** (AWS SM / GCP / Azure / Vault / Doppler / Sealed Secrets) theo nơi host cluster.
- [ ] **Đặt naming convention** secret path, ví dụ:
  - `collabspace/staging/shared` → `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `METRICS_AUTH_TOKEN`
  - `collabspace/staging/datastores` → postgres/mongo/redis/rabbit passwords
  - `collabspace/staging/auth-service` → `MAIL_PASSWORD`, …
- [ ] Cài **External Secrets Operator** (hoặc operator tương đương) trên cluster staging.
- [ ] Tạo `ExternalSecret` CRD map path SM → K8s `Secret` `collabspace-shared-secrets`.
- [ ] Cập nhật Helm `deployment.yaml`: `envFrom` secretRef + giữ ConfigMap cho non-secret.
- [ ] **Bổ sung gap Helm:** `INTERNAL_SERVICE_TOKEN` chưa có trong `templates/apps/secret.yaml` — thêm vào `global.secrets.internalServiceToken` và inject user/workspace/task/notification.
- [ ] **Bổ sung gap Helm:** `MAIL_*` cho auth email outbox (staging có thể Mailtrap/SendGrid key trong SM).
- [ ] Thay placeholder `stringData` trong [secret.yaml](../../infrastructure/helm/collabspace/templates/apps/secret.yaml) — prod **không** render từ `values.yaml` plaintext.
- [ ] Tạo `values-staging.yaml.example` (commit được): liệt kê key **tên** secret, không giá trị.

#### 2.3 Quy trình `.env` cho developer (local)

- [ ] Document 1 trang **“Local env setup”** (có thể append vào `infrastructure/docker/README` hoặc wiki):
  1. `cp services/*/\.env.example` → `.env` từng service.
  2. Set **cùng** `JWT_SECRET` + `INTERNAL_SERVICE_TOKEN` theo [docker/.env.example](../../infrastructure/docker/.env.example).
  3. `ALLOW_DEV_IDENTITY_HEADERS=true` chỉ local; **không** bật staging/prod.
- [ ] (Tùy chọn) **Doppler / dotenv-vault** project `collabspace-dev`: dev chạy `doppler run -- docker compose up` thay copy `.env` thủ công.
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

| Giá trị | Local Compose | Helm `global.secrets` | Secret Manager key |
|---------|---------------|----------------------|-------------------|
| JWT | `auth-service/.env` | `jwtSecret` | `JWT_SECRET` |
| Internal S2S | 4 service `.env` | *(cần thêm)* `internalServiceToken` | `INTERNAL_SERVICE_TOKEN` |
| Postgres | URL trong `.env` | `postgresPassword` | `POSTGRES_PASSWORD` |
| Mongo | `MONGO_URI` | `mongoPassword` | `MONGO_PASSWORD` |
| Redis | `REDIS_PASSWORD` | `redisPassword` | `REDIS_PASSWORD` |
| RabbitMQ | URL trong `.env` | `rabbitmqPassword` | `RABBITMQ_PASSWORD` |
| Metrics | `METRICS_AUTH_TOKEN` | `metricsAuthToken` | `METRICS_AUTH_TOKEN` |
| SMTP | `MAIL_*` auth | *(cần thêm vào secret template)* | `MAIL_USER`, `MAIL_PASSWORD` |

- [ ] Script kiểm tra (infra): `scripts/verify-env-parity.sh` — so sánh tên biến trong tất cả `.env.example` vs Helm ConfigMap/Secret keys (không in giá trị).

**Definition of Done (Secret Manager):**

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

**Hiện trạng:** `infrastructure/docker/docker-compose.jenkins.yml` + scripts `build.sh`, `test.sh`, `deploy.sh` — **chưa có Jenkinsfile / GitHub Actions**.

- [ ] **Option A — Jenkins:** Jenkinsfile multibranch:
  1. Lint + unit test per service (`pnpm test` — dùng script hiện có, đổi `npm` → `pnpm` nếu cần).
  2. Build Docker image khi merge `main` / tag release.
  3. Push registry.
  4. Trigger deploy staging (Helm upgrade).
- [ ] **Option B — GitHub Actions:** workflow tương đương (repo đang dùng GitHub, chưa có `.github/workflows/`).
- [ ] Cache `pnpm` / Docker layer để pipeline < 15 phút (mục tiêu ban đầu).
- [ ] Branch protection: PR bắt buộc pass test trước merge.

### 6. Pipeline CD (deploy)

- [ ] Staging: `helm upgrade --install` sau CI success trên `main`.
- [ ] Production: manual approval hoặc tag-only deploy.
- [ ] Chạy migration job (init container hoặc Job K8s) **trước** rollout app — thứ tự: auth → user → workspace → task → notification.
- [ ] Post-deploy: gọi `infrastructure/resilience/drills/verify-readiness.sh` (hoặc `.ps1`) — fail pipeline nếu không ready.

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

### 11. Post-deploy smoke (không cần code app mới)

- [ ] Tích hợp `verify-readiness.sh` / `.ps1` vào CD job.
- [ ] (Tùy chọn) curl health qua Traefik ingress URL (không chỉ localhost).
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

| Hạng mục | Owner gợi ý |
|----------|-------------|
| Demo E2E script 7 bước MVP | Backend / QA |
| Activity feed API | task-service dev |
| Swagger/OpenAPI thiếu service | từng service owner |
| Inject `requestId` vào Nest Logger (structured log trong code) | app dev |
| Feature mới auth/task/notification | service teams |

Infra **hỗ trợ** bằng: ELK field extraction, trace collector, smoke job — không viết business API.

---

## Checklist tổng hợp (copy vào sprint)

| # | Công việc | Ưu tiên | Trạng thái |
|---|-----------|---------|------------|
| 1 | Chốt Secret Manager provider + naming convention | P0 | ⬜ |
| 2 | External Secrets Operator + `ExternalSecret` staging | P0 | ⬜ |
| 3 | Helm: thêm `INTERNAL_SERVICE_TOKEN` + `MAIL_*` vào Secret template | P0 | ⬜ |
| 4 | `values-staging.yaml.example` + map SM → K8s Secret | P0 | ⬜ |
| 5 | Doc local `.env` setup + shared JWT/INTERNAL token | P0 | ⬜ |
| 6 | CI/pre-commit: chặn commit file `.env` | P0 | ⬜ |
| 7 | `verify-env-parity.sh` (tên biến .env.example vs Helm) | P0 | ⬜ |
| 8 | Metrics auth + Prometheus scrape | P0 | ⬜ |
| 9 | Secret rotation runbook (JWT, INTERNAL, DB) | P0 | ⬜ |
| 10 | `values-staging.yaml` + deploy Helm document | P0 | ⬜ |
| 11 | Container registry + build pipeline | P1 | ⬜ |
| 12 | Jenkinsfile hoặc GitHub Actions CI/CD | P1 | ⬜ |
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
| Danh sách env bắt buộc per service | Helm ConfigMap/Secret mapping |
| Quyết định cloud provider (AWS/GCP/Azure/on-prem) | EKS/GKE/AKS, managed DB, secret manager |

---

*Tạo: 2026-06-10 — đồng bộ với Phase B (trust boundaries), Phase C (`X-Request-Id`). Cập nhật 2026-06-11: bổ sung Secret Manager & quản lý `.env`. Cập nhật file này khi đóng từng mục trong production-hardening.*
