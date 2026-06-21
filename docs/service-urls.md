# CollabSpace — Chỉ mục URL (API, Swagger, Infrastructure)

Tài liệu tham chiếu nhanh các URL truy cập **production Droplet**, **local Docker**, và **observability**.  
Route chi tiết từng endpoint: [`api-routes.md`](./api-routes.md) · Observability: [`observability.md`](./observability.md)

---

## Production Droplet (K8s + Traefik)

| Thông tin | Giá trị |
|-----------|---------|
| **Domain** | `collabspace.ngocanh2005it.site` (IP: `167.172.77.110`) |
| **Protocol** | **HTTPS** (Let's Encrypt, tự renew — cert đến 13/09/2026) |
| **SSH** | `ssh root@167.172.77.110` |

**Agents:** troubleshooting deploy/rollout/probe trên VPS → [`.claude/docs/droplet-vps-operations.md`](../.claude/docs/droplet-vps-operations.md)

---

## API Gateway

Base URL: **`https://collabspace.ngocanh2005it.site/api/v1`**

| Service | Base path | Ví dụ (Droplet) |
|---------|-----------|-----------------|
| Auth | `/api/v1/auth` | https://collabspace.ngocanh2005it.site/api/v1/auth |
| User | `/api/v1/users` | https://collabspace.ngocanh2005it.site/api/v1/users |
| Workspace | `/api/v1/workspaces` | https://collabspace.ngocanh2005it.site/api/v1/workspaces |
| Task | `/api/v1/tasks` | https://collabspace.ngocanh2005it.site/api/v1/tasks |
| Notification | `/api/v1/notifications` | https://collabspace.ngocanh2005it.site/api/v1/notifications |
| DLQ | `/api/v1/dlq` | https://collabspace.ngocanh2005it.site/api/v1/dlq |
| Analytics | `/api/v1/analytics` | https://collabspace.ngocanh2005it.site/api/v1/analytics |

### Health / readiness

| Service | Ready probe |
|---------|-------------|
| Auth | https://collabspace.ngocanh2005it.site/api/v1/auth/health/ready |
| User | https://collabspace.ngocanh2005it.site/api/v1/users/health/ready |
| Workspace | https://collabspace.ngocanh2005it.site/api/v1/workspaces/health/ready |
| Task | https://collabspace.ngocanh2005it.site/api/v1/tasks/health/ready |
| Notification | https://collabspace.ngocanh2005it.site/api/v1/notifications/health/ready |
| DLQ | https://collabspace.ngocanh2005it.site/api/v1/dlq/health/ready |
| Analytics | https://collabspace.ngocanh2005it.site/api/v1/analytics/health/ready |

**Lưu ý gateway:**

- Client gửi `Authorization: Bearer <JWT>` — Traefik forward-auth qua auth-service `/api/v1/auth/verify`.
- Route **internal** (`/api/v1/users/internal/*`, `/api/v1/workspaces/internal/*`) **bị chặn 503** từ ngoài cluster.
- Metrics: `/api/v1/<service>/metrics` — cần Bearer `METRICS_AUTH_TOKEN` (không public).

---

## Swagger UI (OpenAPI)

Bật khi Helm `gateway.swagger.expose: true`. **Không** qua prefix `/api/v1`; **không** cần JWT.

| Service | Swagger UI | OpenAPI JSON |
|---------|------------|--------------|
| Auth | https://collabspace.ngocanh2005it.site/swagger/auth | https://collabspace.ngocanh2005it.site/swagger/auth-json |
| User | https://collabspace.ngocanh2005it.site/swagger/user | https://collabspace.ngocanh2005it.site/swagger/user-json |
| Workspace | https://collabspace.ngocanh2005it.site/swagger/workspace | https://collabspace.ngocanh2005it.site/swagger/workspace-json |
| Task | https://collabspace.ngocanh2005it.site/swagger/task | https://collabspace.ngocanh2005it.site/swagger/task-json |
| Notification | https://collabspace.ngocanh2005it.site/swagger/notification | https://collabspace.ngocanh2005it.site/swagger/notification-json |
| DLQ | https://collabspace.ngocanh2005it.site/swagger/dlq | https://collabspace.ngocanh2005it.site/swagger/dlq-json |
| Analytics | https://collabspace.ngocanh2005it.site/swagger/analytics | https://collabspace.ngocanh2005it.site/swagger/analytics-json |

Pattern chung: `https://collabspace.ngocanh2005it.site/swagger/<tên-rút-gọn>` và `https://collabspace.ngocanh2005it.site/swagger/<tên-rút-gọn>-json`.

Mỗi endpoint có **request/response schema** (`@ApiOkResponse`, `@ApiCreatedResponse`, DTO `@ApiProperty`).

---

## Infrastructure & Observability

### Grafana (public qua Traefik)

| Mục đích | URL |
|----------|-----|
| **Trang chủ** | https://collabspace.ngocanh2005it.site/grafana/ |
| **Explore — Loki** (tail/search log) | https://collabspace.ngocanh2005it.site/grafana/explore |
| **Explore — Prometheus** (PromQL) | https://collabspace.ngocanh2005it.site/grafana/explore?orgId=1&left=%7B%22datasource%22:%22prometheus%22%7D |

**Đăng nhập:** user `admin` — password từ Helm/Grafana PVC (mặc định chart: `collabspace-grafana`; PVC cũ có thể khác).

### Dashboard Grafana (folder **CollabSpace**)

| Dashboard | UID | URL trực tiếp |
|-----------|-----|---------------|
| Service Health | `collabspace-service-health` | https://collabspace.ngocanh2005it.site/grafana/d/collabspace-service-health/collabspace-service-health |
| App Logs | `collabspace-logs-errors` | https://collabspace.ngocanh2005it.site/grafana/d/collabspace-logs-errors/collabspace-logs-errors |
| Load Test Run | `collabspace-load-test` | https://collabspace.ngocanh2005it.site/grafana/d/collabspace-load-test/collabspace-load-test |

### Thành phần **không** expose public (chỉ trong cluster K8s)

| Thành phần | URL nội bộ | Ghi chú |
|------------|------------|---------|
| Prometheus | `http://prometheus:9090` | Scrape metrics app + Traefik |
| Loki | `http://loki:3100` | Log aggregation |
| Alertmanager | cluster DNS | Chưa route public |
| Vault + ESO | cluster | Secrets prod — xem [`infrastructure/vault/README.md`](../infrastructure/vault/README.md) |
| Kafka + Debezium Connect | cluster | Event bus — xem [`infrastructure/kafka/README.md`](../infrastructure/kafka/README.md) |
| Jaeger | — | `observability.jaeger.enabled: false` (tắt mặc định) |

### Load test (k6)

```bash
# Smoke — app health
BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 \
GRAFANA_URL=https://collabspace.ngocanh2005it.site/grafana \
GRAFANA_PASSWORD=<admin-password> \
./infrastructure/load-testing/run-load-test.sh smoke

# Demo flow — login → workspaces / tasks / notifications
BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 K6_VUS=10 \
./infrastructure/load-testing/run-load-test.sh demo-flow
```

Script prod: `infrastructure/deploy/run-k6-smoke-prod.sh` · Chi tiết: [`infrastructure/load-testing/README.md`](../infrastructure/load-testing/README.md).

### Demo E2E

```bash
BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 ./scripts/demo-e2e.sh
# Windows:
# $env:BASE_URL="https://collabspace.ngocanh2005it.site/api/v1"; .\scripts\demo-e2e.ps1
```

**Demo users** (sau seed): `ngocanh@collabspace.dev`, `quangtien@collabspace.dev` — password `collabspace123`.

---

## Local Docker (dev)

### Qua Traefik gateway

| Mục đích | URL |
|----------|-----|
| API base | http://localhost/api/v1 |

### Trực tiếp cổng mapped (host → container)

| Service | Host port | Container port | Swagger | Health ready |
|---------|-----------|----------------|---------|--------------|
| auth-service | 3000 | 3000 | http://localhost:3000/swagger | http://localhost:3000/api/v1/auth/health/ready |
| user-service | 3001 | 3000 | http://localhost:3001/swagger | http://localhost:3001/api/v1/users/health/ready |
| workspace-service | 3002 | **8080** | http://localhost:3002/swagger | http://localhost:3002/api/v1/workspaces/health/ready |
| task-service | 3003 | 3000 | http://localhost:3003/swagger | http://localhost:3003/api/v1/tasks/health/ready |
| notification-service | 3004 | 3000 | http://localhost:3004/swagger | http://localhost:3004/api/v1/notifications/health/ready |
| dlq-service | 3006 | 3000 | http://localhost:3006/swagger | http://localhost:3006/api/v1/dlq/health/ready |
| analytics-service | 3005 | 3000 | http://localhost:3005/swagger | http://localhost:3005/api/v1/analytics/health/ready |

### Observability local (Compose profile)

| Thành phần | URL |
|------------|-----|
| Grafana | http://localhost:3005 |
| Đăng nhập mặc định | `admin` / `collabspace-grafana` |

Compose: `docker-compose.monitoring.yml`, `docker-compose.logging.yml` — xem [`.claude/docs/development-workflows.md`](../.claude/docs/development-workflows.md).

---

## Helm / gateway flags

Trong `infrastructure/helm/collabspace/values.yaml` (hoặc `values-prod.yaml`):

| Flag | Mặc định | Ý nghĩa |
|------|----------|---------|
| `gateway.enabled` | `true` | Traefik IngressRoute |
| `gateway.grafana.expose` | `true` | Public `/grafana/` |
| `gateway.swagger.expose` | `true` | Public `/swagger/<service>` |
| `observability.grafana.enabled` | `true` | Grafana subchart |
| `observability.prometheus.enabled` | `true` | Prometheus |
| `observability.loki.enabled` | `true` | Loki + Promtail |

Prod mẫu: [`values-prod.example.yaml`](../infrastructure/helm/collabspace/values-prod.example.yaml).

---

## Tài liệu liên quan

| Tài liệu | Nội dung |
|----------|----------|
| [`api-routes.md`](./api-routes.md) | Chỉ mục route HTTP đầy đủ |
| [`observability.md`](./observability.md) | Grafana, Loki, Prometheus, k6 |
| [`deployment-droplet-ip-quickstart.md`](./deployment-droplet-ip-quickstart.md) | Deploy Droplet bằng IP |
| [`deployment-k3s-phases.md`](./deployment-k3s-phases.md) | Lộ trình Phase 0–5 |
| [`infrastructure/helm/README.md`](../infrastructure/helm/README.md) | Helm chart, troubleshooting |
