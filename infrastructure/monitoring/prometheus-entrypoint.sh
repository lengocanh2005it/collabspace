#!/bin/sh
# Write METRICS_AUTH_TOKEN for Prometheus scrape authorization (matches app services).
mkdir -p /etc/prometheus/secrets
if [ -n "${METRICS_AUTH_TOKEN:-}" ]; then
  printf '%s' "${METRICS_AUTH_TOKEN}" > /etc/prometheus/secrets/metrics_auth_token
else
  : > /etc/prometheus/secrets/metrics_auth_token
fi
exec /bin/prometheus "$@"
