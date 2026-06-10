# HighLatencyP99

**Alert:** p99 latency > 2s for 5 minutes  
**Severity:** warning

## Diagnosis

1. Check slow dependency calls (gRPC user profile, workspace HTTP client).
2. Inspect DB slow queries and Mongo index usage.
3. Review traffic spike vs capacity.

## Remediation

1. Restore slow dependencies or enable circuit-breaker fail-fast paths.
2. Add indexes or optimize hot queries.
3. Scale replicas and verify connection pool limits.
