import { Logger } from '@nestjs/common';

const logger = new Logger('Tracing');

export function bootstrapTracing(serviceName: string): void {
  if (process.env.TRACING_ENABLED !== 'true') {
    return;
  }

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    process.env.JAEGER_ENDPOINT ??
    (process.env.JAEGER_AGENT_HOST
      ? `http://${process.env.JAEGER_AGENT_HOST}:${process.env.JAEGER_AGENT_PORT ?? '14268'}/api/traces`
      : undefined);

  if (!endpoint) {
    logger.warn(
      `${serviceName}: TRACING_ENABLED=true but no OTLP/Jaeger endpoint configured`,
    );
    return;
  }

  logger.log(
    `${serviceName}: distributed tracing enabled (exporter=${endpoint}). Start Jaeger via infrastructure/docker/docker-compose.tracing.yml`,
  );
}
