import { Logger } from '@nestjs/common';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const logger = new Logger('Tracing');
let sdk: NodeSDK | undefined;

function resolveOtlpEndpoint(): string | undefined {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  }

  if (process.env.JAEGER_AGENT_HOST) {
    return `http://${process.env.JAEGER_AGENT_HOST}:4318/v1/traces`;
  }

  return undefined;
}

export function startTracing(serviceName: string): void {
  if (process.env.TRACING_ENABLED !== 'true' || sdk) {
    return;
  }

  const endpoint = resolveOtlpEndpoint();
  if (!endpoint) {
    logger.warn(`${serviceName}: TRACING_ENABLED=true but no OTLP/Jaeger endpoint configured`);
    return;
  }

  if (process.env.OTEL_LOG_LEVEL === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  logger.log(`${serviceName}: OpenTelemetry tracing enabled (${endpoint})`);

  const shutdown = () => {
    void sdk?.shutdown();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
