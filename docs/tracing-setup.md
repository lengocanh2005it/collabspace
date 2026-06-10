# Distributed tracing setup

CollabSpace services support optional tracing via environment variables. Full OpenTelemetry auto-instrumentation can be added later; the current bootstrap logs the exporter target when enabled.

## Local Jaeger

```sh
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.tracing.yml up -d jaeger
```

Jaeger UI: http://localhost:16686

## Enable per service

```env
TRACING_ENABLED=true
JAEGER_AGENT_HOST=jaeger
JAEGER_AGENT_PORT=6831
# or OTLP:
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
```

Each service calls `bootstrapTracing('<service-name>')` at startup (`src/observability/tracing.ts`).

## K8s

Auth deployment ConfigMap already sets `JAEGER_AGENT_HOST` / `JAEGER_AGENT_PORT`. Set `TRACING_ENABLED=true` when OTEL SDK is wired.
