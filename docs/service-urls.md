# CollabSpace — Chỉ mục URL (API, Swagger, Infrastructure)

Tài liệu tham chiếu nhanh các URL truy cập **production Droplet**, **local Docker**, và **observability**.  
Route chi tiết từng endpoint: [`api-routes.md`](./api-routes.md) · Observability: [`observability.md`](./observability.md)

---

## Production Droplet (K8s + Traefik)

| Thông tin | Giá trị |
|-----------|---------|
| **Host hiện tại** | `167.172.77.110` |
| **Ký hiệu** | Thay `<HOST>` bằng IP hoặc domain khi có DNS/TLS |
| **Protocol** | HTTP (HTTPS — Phase 5, chưa bật) |
| **SSH** | `ssh root@167.172.77.110` |

---

## API Gateway

Base URL: **`http://<HOST>/api/v1`**

| Service | Base path | Ví dụ (Droplet) |
|---------|-----------|-----------------|
| Auth | `/api/v1/auth` | http://167.172.77.110/api/v1/auth |
| User | `/api/v1/users` | http://167.172.77.110/api/v1/users |
| Workspace | `/api/v1/workspaces` | http://167.172.77.110/api/v1/workspaces |
| Task | `/api/v1/tasks` | http://167.172.77.110/api/v1/tasks |
| Notification | `/api/v1/notifications` | http://167.172.77.110/api/v1/notifications |

### Health / readiness

| Service | Ready probe |
|---------|-------------|
| Auth | http://167.172.77.110/api/v1/auth/health/ready |
| User | http://167.172.77.110/api/v1/users/health/ready |
| Workspace | http://167.172.77.110/api/v1/workspaces/health/ready |
| Task | http://167.172.77.110/api/v1/tasks/health/ready |
| Notification | http://167.172.77.110/api/v1/notifications/health/ready |

**Lưu ý gateway:**

- Client gửi `Authorization: Bearer <JWT>` — Traefik forward-auth qua auth-service `/api/v1/auth/verify`.
- Route **internal** (`/api/v1/users/internal/*`, `/api/v1/workspaces/internal/*`) **bị chặn 503** từ ngoài cluster.
- Metrics: `/api/v1/<service>/metrics` — cần Bearer `METRICS_AUTH_TOKEN` (không public).

---

## Swagger UI (OpenAPI)

Bật khi Helm `gateway.swagger.expose: true`. **Không** qua prefix `/api/v1`; **không** cần JWT.

| Service | Swagger UI | OpenAPI JSON |
|---------|------------|--------------|
| Auth | http://167.172.77.110/swagger/auth | http://167.172.77.110/swagger/auth-json |
| User | http://167.172.77.110/swagger/user | http://167.172.77.110/swagger/user-json |
| Workspace | http://167.172.77.110/swagger/workspace | http://167.172.77.110/swagger/workspace-json |
| Task | http://167.172.77.110/swagger/task | http://167.172.77.110/swagger/task-json |
| Notification | http://167.172.77.110/swagger/notification | http://167.172.77.110/swagger/notification-json |

Pattern chung: `http://<HOST>/swagger/<tên-rút-gọn>` và `http://<HOST>/swagger/<tên-rút-gọn>-json`.

Mỗi endpoint có **request/response schema** (`@ApiOkResponse`, `@ApiCreatedResponse`, DTO `@ApiProperty`).

---

## Infrastructure & Observability

### Grafana (public qua Traefik)

| Mục đích | URL |
|----------|-----|
| **Trang chủ** | http://167.172.77.110/grafana/ |
| **Explore — Loki** (tail/search log) | http://167.172.77.110/grafana/explore |
| **Explore — Prometheus** (PromQL) | http://167.172.77.110/grafana/explore?orgId=1&left=%7B%22datasource%22:%22prometheus%22%7D |

**Đăng nhập:** user `admin` — password từ Helm/Grafana PVC (mặc định chart: `collabspace-grafana`; PVC cũ có thể khác).

### Dashboard Grafana (folder **CollabSpace**)

| Dashboard | UID | URL trực tiếp |
|-----------|-----|---------------|
| Service Health | `collabspace-service-health` | http://167.172.77.110/grafana/d/collabspace-service-health/collabspace-service-health |
| App Logs | `collabspace-logs-errors` | http://167.172.77.110/grafana/d/collabspace-logs-errors/collabspace-logs-errors |
| Load Test Run | `collabspace-load-test` | http://167.172.77.110/grafana/d/collabspace-load-test/collabspace-load-test |

### Thành phần **không** expose public (chỉ trong cluster K8s)

| Thành phần | URL nội bộ | Ghi chú |
|------------|------------|---------|
| Prometheus | `http://prometheus:9090` | Scrape metrics app + Traefik |
| Loki | `http://loki:3100` | Log aggregation |
| Alertmanager | cluster DNS | Chưa route public |
| Vault + ESO | cluster | Secrets prod — xem [`infrastructure/vault/README.md`](../infrastructure/vault/README.md) |
| RabbitMQ management | cluster | Không public |
| Jaeger | — | `observability.jaeger.enabled: false` (tắt mặc định) |

### Load test (k6)

```bash
# Smoke — health 5 service
BASE_URL=http://167.172.77.110/api/v1 \
GRAFANA_URL=http://167.172.77.110/grafana \
GRAFANA_PASSWORD=<admin-password> \
./infrastructure/load-testing/run-load-test.sh smoke

# Demo flow — login → workspaces / tasks / notifications
BASE_URL=http://167.172.77.110/api/v1 K6_VUS=10 \
./infrastructure/load-testing/run-load-test.sh demo-flow
```

Script prod: `infrastructure/deploy/run-k6-smoke-prod.sh` · Chi tiết: [`infrastructure/load-testing/README.md`](../infrastructure/load-testing/README.md).

### Demo E2E

```bash
BASE_URL=http://167.172.77.110/api/v1 ./scripts/demo-e2e.sh
# Windows:
# $env:BASE_URL="http://167.172.77.110/api/v1"; .\scripts\demo-e2e.ps1
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
