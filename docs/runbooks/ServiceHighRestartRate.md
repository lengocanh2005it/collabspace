# ServiceHighRestartRate

**Alert:** more than 2 restarts in 15 minutes  
**Severity:** warning

## Diagnosis

Check OOM kills, unhandled startup exceptions, and failed readiness probes.

## Remediation

1. Increase memory limits if OOMKilled (see `docs/production-hardening.md`).
2. Fix startup dependency ordering (DB migrations before traffic).
3. Ensure `preStop` sleep allows graceful drain (K8s deployments).
