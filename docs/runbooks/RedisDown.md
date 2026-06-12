# RedisDown

**Cảnh báo:** `redis_up == 0`  
**Mức độ:** critical  
**Consumer chính:** auth-service (OTP, session)

## Khắc phục

1. `docker compose -f infrastructure/docker/docker-compose.db.yml up -d redis` hoặc restart pod Redis trên K8s.
2. Restart auth-service; verify `/api/v1/auth/health/ready`.
3. Luồng OTP có thể fail cho đến khi Redis healthy — thông báo tác động user.
