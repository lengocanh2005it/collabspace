# RedisDown

**Alert:** `redis_up == 0`  
**Severity:** critical  
**Primary consumer:** auth-service (OTP, session helpers)

## Remediation

1. `docker compose -f infrastructure/docker/docker-compose.db.yml up -d redis`
2. Restart auth-service; verify `/api/v1/auth/health/ready`.
3. OTP flows may fail until Redis is healthy — communicate user impact.
