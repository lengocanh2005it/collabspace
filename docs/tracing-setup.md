# Cấu hình distributed tracing

Các service CollabSpace dùng OpenTelemetry Node SDK với export OTLP HTTP sang Jaeger.

## Jaeger local

```sh
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.tracing.yml up -d jaeger
```

Jaeger UI: http://localhost:16686  
OTLP HTTP endpoint: `http://localhost:4318/v1/traces`

## Bật theo từng service

```env
TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
# hoặc env legacy (resolve sang OTLP cổng 4318):
JAEGER_AGENT_HOST=jaeger
```

Mỗi service load `src/observability/instrumentation.ts` trước khi bootstrap NestJS.

## Kubernetes

Đặt `TRACING_ENABLED=true` trên deployment app. Jaeger all-in-one cần expose OTLP (`COLLECTOR_OTLP_ENABLED=true`). Grafana datasource cho Jaeger được provision sẵn trong `infrastructure/monitoring/grafana-deployment.yaml`.

Production: chỉ bật khi collector reachable — xem [production-hardening.md](./production-hardening.md).

## Tài liệu liên quan

- [resilience-overview.md](./resilience-overview.md)
- [team/phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) — tracing staging/prod
