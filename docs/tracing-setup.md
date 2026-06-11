# Distributed tracing setup

CollabSpace services use OpenTelemetry Node SDK with OTLP HTTP export to Jaeger.

## Local Jaeger

```sh
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.tracing.yml up -d jaeger
```

Jaeger UI: http://localhost:16686  
OTLP HTTP endpoint: `http://localhost:4318/v1/traces`

## Enable per service

```env
TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
# or legacy env (resolves to OTLP on port 4318):
JAEGER_AGENT_HOST=jaeger
```

Each service loads `src/observability/instrumentation.ts` before NestJS bootstrap.

## K8s

Set `TRACING_ENABLED=true` on app deployments. Jaeger all-in-one should expose OTLP (`COLLECTOR_OTLP_ENABLED=true`). Grafana datasource for Jaeger is pre-provisioned in `infrastructure/monitoring/grafana-deployment.yaml`.
