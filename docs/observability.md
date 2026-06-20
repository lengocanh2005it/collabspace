# CollabSpace — Observability (Grafana, Prometheus, Loki, k6)

Tài liệu vận hành **quan sát hệ thống**: metric, log, dashboard Grafana, và load test k6.  
Stack chính trên **K8s/Helm**; Docker Compose dùng cho local dev.

## Kiến trúc (K8s production)

```text
Apps ──metrics──► Prometheus ◄── scrape ── Traefik, exporters
   │                      │
   │ logs (stdout)        └── datasource ──► Grafana (/grafana)
   ▼
 Promtail ──► Loki ── datasource ──► Grafana Explore (tail/search)
```

| Thành phần | Helm / path | Ghi chú |
|------------|-------------|---------|
| Prometheus | `infrastructure/helm/collabspace/templates/observability/prometheus.yaml` | Scrape app pods (`kubernetes_sd`), Bearer `metricsAuthToken` |
| Grafana | subchart `grafana` + `templates/observability/grafana-dashboards-configmap.yaml` | Datasource UID: `prometheus`, `loki` |
| Loki + Promtail | subcharts trong `values.yaml` | Chỉ namespace `collabspace`; **Loki canary tắt** (`loki.lokiCanary.enabled: false`) |
| Dashboard JSON | `infrastructure/helm/collabspace/dashboards/*.json` | Sync bản copy: `infrastructure/monitoring/grafana-dashboards/` |
| Alert rules (tham chiếu) | `infrastructure/monitoring/alert-rules.yml` | Runbook: `docs/runbooks/` |
| Alertmanager | `templates/observability/alertmanager.yaml` | Slack receiver qua Vault/ESO `alertmanager-slack-secret`; test trên Droplet 2026-06-20 |
| k6 | `infrastructure/load-testing/` | Scenario `smoke`, `demo-flow` |

**Local Docker** (profile tách): `docker-compose.monitoring.yml`, `docker-compose.logging.yml`, `docker-compose.loadtest.yml` — xem [development-workflows.md](../.claude/docs/development-workflows.md).

## Truy cập Grafana (K8s)

| Môi trường | URL | Ghi chú |
|------------|-----|---------|
| Production Droplet (IP) | `http://<HOST>/grafana/` | Traefik `IngressRoute` — `gateway.grafana.expose: true` |
| Local Compose | `http://localhost:3005` | Không subpath |

Đăng nhập prod: user `admin` — password từ Helm/Grafana PVC (có thể khác `values.yaml` nếu PVC cũ). **Không** commit password thật.

## Ba dashboard — ba việc

Folder Grafana: **CollabSpace**

| Dashboard | UID | Dùng khi |
|-----------|-----|----------|
| **CollabSpace Service Health** | `collabspace-service-health` | UP/DOWN, request rate, latency, CPU/RAM app |
| **CollabSpace App Logs** | `collabspace-logs-errors` | **Xu hướng** log (volume, error lines) — **không** tail ở đây |
| **CollabSpace Load Test Run** | `collabspace-load-test` | Xem metric khi chạy k6; annotation tag `k6` |
| **CollabSpace DLQ** | `collabspace-dlq` | Records by status/category, replay success/fail rate, oldest pending age gauge (alert ≥30min), events ingested per topic |

### Đọc log chi tiết → Explore (Loki)

Dashboard **App Logs** chỉ có chart. Để search/tail:

1. Menu trái → **Explore** → datasource **Loki**
2. Query mẫu:

```logql
{namespace="collabspace", app="auth-service"}
{namespace="collabspace", app="auth-service"} |~ "(?i)(error|exception|fatal)"
```

Label `app` có giá trị: `auth-service`, `user-service`, `workspace-service`, `task-service`, `notification-service`, …

**Không dùng** cú pháp Loki trong Prometheus Explore (`{namespace="..."}` là LogQL, không phải PromQL).

### Prometheus query mẫu (Explore → Prometheus)

```promql
up{job="auth-service"}
sum(rate(http_requests_total{job="auth-service"}[5m]))
sum by (job) (collabspace_process_resident_memory_bytes{job=~"auth-service|user-service"})
```

Default metrics app dùng prefix `collabspace_` (ví dụ `collabspace_process_cpu_seconds_total`).

## Prometheus scrape (K8s)

- Pod Prometheus **bắt buộc** `serviceAccountName: prometheus` (RBAC list/watch pods).
- App metrics: annotation `prometheus.io/scrape` trên Deployment; job per app trong ConfigMap.
- Prod: `global.secrets.metricsAuthToken` → Secret app + `prometheus-metrics-auth` → scrape `authorization.credentials_file`.
- Traefik: job `traefik` (pod label / pod name `traefik*`).
- NetworkPolicy: `allow-prometheus-scraping`, `allow-grafana-to-prometheus`, `allow-loki-clients`.

## Load test (k6)

```bash
# Smoke — app health, VU thấp (an toàn prod)
BASE_URL=http://<HOST>/api/v1 \
GRAFANA_URL=http://<HOST>/grafana \
GRAFANA_PASSWORD=<admin-password> \
./infrastructure/load-testing/run-load-test.sh smoke

# Demo flow — login user seed → workspaces / tasks / notifications
BASE_URL=http://<HOST>/api/v1 K6_VUS=10 \
./infrastructure/load-testing/run-load-test.sh demo-flow

# SLO baseline — hot read paths with per-route p95 thresholds
BASE_URL=http://<HOST>/api/v1 K6_VUS=10 K6_DURATION=2m \
./infrastructure/load-testing/run-load-test.sh slo-baseline
# hoặc: ./scripts/k6-slo-baseline.sh
```

Script prod: `infrastructure/deploy/run-k6-smoke-prod.sh`

**Demo users** (sau `run-k8s-seed.sh`): `ngocanh@collabspace.dev`, `quangtien@collabspace.dev` — password `collabspace123`.

Workflow k6 + Grafana:

1. Mở **Load Test Run** + **App Logs** (chart) + **Explore** (tail)
2. Chạy k6 với `GRAFANA_URL` → marker cam **k6** trên timeline
3. Threshold trong script (`http_req_failed`, `p(95)`)

Chi tiết: [infrastructure/load-testing/README.md](../infrastructure/load-testing/README.md).

## Troubleshooting

| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|---------------------------|
| Dashboard metric trống | Prometheus chưa scrape — kiểm tra Targets; pod Prometheus dùng SA `prometheus` |
| App metrics 401 | Thiếu `metricsAuthToken` trên Prometheus scrape |
| Log toàn exporter/loki canary | Dùng **App Logs** (lọc app services) hoặc Explore; tắt canary: `loki.lokiCanary.enabled: false` + `loki.test.enabled: false` |
| `pg_up` / `redis_up` = 0 | Exporter chưa kết nối DB (NetworkPolicy/password) — backlog infra |
| Grafana login fail | PVC giữ password cũ — reset hoặc `grafana-cli admin reset-admin-password` |
| k6 demo-flow fail login | Chưa seed demo users |

## Còn lại (backlog)

- Sync `alert-rules.yml` vào Prometheus K8s
- Sửa postgres/redis exporter scrape
- Ghi **capacity baseline** sau k6 (P3)
- HTTPS cho `/grafana`
- Jaeger tracing (`TRACING_ENABLED`) — tùy chọn

Tham chiếu: [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md), [production-hardening.md](./production-hardening.md).
