# Local Environment Setup Guide

To ensure a smooth local development experience with Docker Compose, please follow these steps to configure your environment variables.

## 1. Create your local .env files
For every service in the `services/` folder, duplicate the `.env.example` file and rename it to `.env`.

```bash
cp services/auth-service/.env.example services/auth-service/.env
cp services/user-service/.env.example services/user-service/.env
# ... repeat for all services
```

## 2. Sync Global Shared Secrets
Our microservices communicate securely using shared tokens. To ensure they can talk to each other locally, your local `.env` files must share the exact same values for these keys.

Copy the global values from `infrastructure/docker/.env.example`:

1. **`JWT_SECRET`**: Must be identical in `auth-service` and `notification-service`.
2. **`INTERNAL_SERVICE_TOKEN`**: Must be identical in `user-service`, `workspace-service`, `task-service`, and `notification-service`.

## 3. Local Development Overrides
* **`ALLOW_DEV_IDENTITY_HEADERS=true`**: This is explicitly enabled in your local `.env` files. It allows you to bypass strict authentication when testing locally via Postman or Swagger by injecting mock identity headers. **This is strictly blocked in staging and production.**
* **`TRACING_ENABLED=true`**: If you spin up Jaeger locally using `docker-compose.tracing.yml`, ensure this is set to true to view your traces at `localhost:16686`.
