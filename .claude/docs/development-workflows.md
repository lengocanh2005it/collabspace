# CollabSpace Development Workflows

## First Read Checklist

Before editing:

1. Read `README.md` and `docs/mvp-demo-scope.md`.
2. Read this `.claude/docs` directory section relevant to the task.
3. Inspect the target service's `package.json`, `src/app.module.ts`, controller, use case/service, entity, repository, migration, and tests.
4. Search for an existing pattern with `rg` before introducing a new abstraction.

## Local Prerequisites

Expected tools:

- Docker and Docker Compose.
- Node.js 18+ for NestJS services.
- `pnpm` 8+ — **workspace root** (`pnpm install`, `pnpm run build`, `pnpm run test`) or per `services/*`.
- Shared package: `packages/shared` (`@collabspace/shared`) — rebuild after event type changes.
- All five app services are NestJS; `workspace-service` uses port **8080**.

## Environment Files

Environment examples exist for most services and infrastructure components:

- `services/auth-service/.env.example`
- `services/user-service/.env.example`
- `services/workspace-service/.env.example`
- `services/task-service/.env.example`
- `services/notification-service/.env.example`
- `infrastructure/rabbitmq/.env.example`
- `infrastructure/redis/.env.example`
- `infrastructure/load-testing/k6/.env.example`
- `infrastructure/docker/.env.example` — shared dev secret notes
- `infrastructure/vault/` — HashiCorp Vault (optional local dev; K8s + ESO for staging/prod)

Rules:

- Do not commit real secrets.
- When adding required env vars, update the matching `.env.example`, config service, Docker Compose file, and README/doc references.
- **Shared secrets (local Docker):** use the same `INTERNAL_SERVICE_TOKEN` in `user-service`, `workspace-service`, `task-service`, and `notification-service` `.env` files; align `JWT_SECRET` between `auth-service` and `notification-service`. See `infrastructure/docker/.env.example`.
- **Optional Vault (local):** `docker compose -f docker-compose.vault.yml up -d` → `infrastructure/vault/scripts/seed-dev-secrets.ps1` → `sync-env-from-vault.ps1`. See `infrastructure/vault/README.md`.
- **K8s + Vault:** External Secrets Operator manifests in `infrastructure/vault/k8s/`; Helm `global.externalSecrets.enabled: true` skips chart `Secret` templates.
- **Trust boundaries:** `ALLOW_DEV_IDENTITY_HEADERS=true` only in local `.env` for workspace/task/notification direct-port testing; production and gateway traffic require `Authorization: Bearer …`.
- In NestJS services, prefer a configuration wrapper over scattered `process.env` reads when the service already has one. `auth-service` uses `ConfigurationService`; `user-service` currently reads more directly in `main.ts` and module factories.

## HashiCorp Vault (optional local secrets)

Single source for shared dev secrets (`JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, DB/RabbitMQ/Redis passwords). Apps still read `.env` — Vault does not replace Compose `env_file` at runtime unless you sync first.

```powershell
cd infrastructure/docker
docker compose -f docker-compose.vault.yml up -d
cd ../..
.\infrastructure\vault\scripts\seed-dev-secrets.ps1
.\infrastructure\vault\scripts\sync-env-from-vault.ps1
```

Linux/macOS: `infrastructure/vault/scripts/seed-dev-secrets.sh` and `sync-env-from-vault.sh`.

K8s staging/prod: Vault + External Secrets Operator — `infrastructure/vault/README.md`; Helm `global.externalSecrets.enabled: true`.

## Docker Compose

Run core local stack from `infrastructure/docker`:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Add Traefik:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.traefik.yml up -d
```

Add monitoring (Prometheus + Alertmanager + Grafana):

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.exporters.yml -f docker-compose.monitoring.yml up -d
```

Full local stack:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.exporters.yml -f docker-compose.monitoring.yml -f docker-compose.logging.yml -f docker-compose.tracing.yml -f docker-compose.traefik.yml up -d
```

Set `TRACING_ENABLED=true` in service `.env` files when using the tracing overlay.

Important local URLs:

- Auth readiness: `http://localhost:3000/api/v1/auth/health/ready`
- User readiness: `http://localhost:3001/api/v1/users/health/ready`
- Workspace readiness: `http://localhost:3002/api/v1/workspaces/health/ready`
- Task readiness: `http://localhost:3003/api/v1/tasks/health/ready`
- Notification readiness: `http://localhost:3004/api/v1/notifications/health/ready`
- App metrics example: `http://localhost:3000/api/v1/auth/metrics`
- Grafana: `http://localhost:3005`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Kibana: `http://localhost:5601`
- Jaeger: `http://localhost:16686`
- Traefik dashboard: `http://localhost:8080`
- RabbitMQ dashboard: `http://localhost:15672`

## Auth Service Workflow

Path:

```sh
cd services/auth-service
```

Commands:

```sh
pnpm install
pnpm run proto:gen
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run lint
pnpm run migrate
pnpm run seed
```

Notes:

- `build` runs `nest build` and `tsc-alias`.
- Unit tests use Jest with `--experimental-vm-modules`.
- Path alias `@/*` maps to `src/*`.
- Database initialization is explicit through `DatabaseService.initialize()`.
- gRPC starts only if enabled through config.

## User Service Workflow

Path:

```sh
cd services/user-service
```

Commands:

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run lint
pnpm run migrate
pnpm run seed
```

Notes:

- `build` currently runs `nest build`.
- Unit tests use Jest.
- Repository implementation switches based on `DATABASE_URL`: TypeORM when present, in-memory otherwise.
- gRPC defaults to enabled unless `GRPC_ENABLED` disables it.

## Migration Workflow

Root helper:

```sh
sh ./scripts/migrate.sh
```

Service-level helpers:

```sh
sh ./services/auth-service/scripts/migrate.sh
sh ./services/user-service/scripts/migrate.sh
```

Direct NestJS service commands:

```sh
cd services/auth-service && pnpm run migrate
cd services/user-service && pnpm run migrate
```

Rules:

- Prefer additive migrations over destructive changes.
- Keep migration filenames ordered and descriptive.
- Update TypeORM entities and SQL migrations together.
- If changing seed assumptions, update seed scripts and README demo account docs.

## Seed Workflow

Preferred order (loads shared demo data from `scripts/demo-seed-data.json`):

```sh
sh ./scripts/seed.sh
```

Per service:

```sh
cd services/auth-service && pnpm run seed
cd ../user-service && pnpm run seed
cd ../workspace-service && pnpm run seed
cd ../task-service && pnpm run seed
cd ../notification-service && pnpm run seed
```

What gets seeded:

- **auth-service** — roles, permissions, verified demo users
- **user-service** — profiles, preferences, status; optional RabbitMQ replica sync
- **workspace-service** — demo workspace, members (User A owner + User B member), MVP project
- **task-service** — user replicas, 3 tasks + event store entries, sample `@mention` comment
- **notification-service** — sample TASK_ASSIGNED + COMMENT_MENTIONED notifications for User B

Demo accounts after seed:

- `tho@collabspace.dev` / `collabspace123`
- `ngocanh@collabspace.dev` / `collabspace123` (User A)
- `quangtien@collabspace.dev` / `collabspace123` (User B)
- `trungtin@collabspace.dev` / `collabspace123`
- `reviewer@collabspace.dev` / `collabspace123`

Run migrations before seeding. Requires Postgres (auth, user, workspace) and MongoDB (task, notification).

## MVP demo verification (E2E script)

After Compose + Traefik + migrate + seed:

```sh
# default BASE_URL=http://localhost/api/v1
./scripts/demo-e2e.sh
```

Windows: `.\scripts\demo-e2e.ps1`. Story and acceptance: `docs/mvp-demo-scope.md`. Infra CI integration: `docs/team/phan-phu-tho-infrastructure-backlog.md` §11.

**k3s production (Droplet):** after CI images include `seed:prod`, run `bash infrastructure/deploy/run-k8s-seed.sh` on the server. E2E without SMTP: `BASE_URL=http://<host>/api/v1 bash infrastructure/deploy/run-demo-e2e-prod.sh` (OTP via `read-auth-otp-from-outbox.sh`).

## Testing Strategy

For small service-local changes:

- Run the relevant unit test file if easy.
- Run `pnpm run test` in the target service before finishing if dependencies are installed.
- Run `pnpm run build` when TypeScript types or module wiring changed.

For controller/API changes:

- Add or update controller/use-case tests.
- Run service `test:e2e` if the change affects routing, validation, auth, or app bootstrap.

For database changes:

- Run migration locally if database is available.
- Run tests that cover repository persistence.
- Verify entities match migration schema.

For cross-service changes:

- Verify producer and consumer contracts.
- Run tests in each affected service.
- Update `.proto` files and generated TypeScript when needed.
- Update docs and Docker/env config.

## Load Testing

Path:

- `infrastructure/load-testing`

k6 scripts exist for:

- auth-service
- user-service
- workspace-service
- task-service
- notification-service

When endpoints change, update the matching k6 script and `config.json`.

## Observability Workflow

Monitoring:

- Prometheus config: `infrastructure/monitoring/prometheus.yml`
- Alert rules: `infrastructure/monitoring/alert-rules.yml`
- Alertmanager: `infrastructure/monitoring/alertmanager.yml`
- Docker overlay: `infrastructure/docker/docker-compose.monitoring.yml`
- Infra exporters overlay: `infrastructure/docker/docker-compose.exporters.yml`
- Grafana deployment: `infrastructure/monitoring/grafana-deployment.yaml`
- Grafana dashboard: `infrastructure/monitoring/grafana-dashboards/service-health.json`
- K8s Prometheus: `infrastructure/k8s/prometheus-deployment.yaml`
- K8s exporters: `infrastructure/k8s/exporters-deployment.yaml`
- Sync K8s alert rules: `infrastructure/k8s/scripts/sync-prometheus-alert-rules.ps1`

Logging:

- Elasticsearch: `infrastructure/logging/elasticsearch-deployment.yaml`
- Kibana: `infrastructure/logging/kibana-deployment.yaml`
- Logstash: `infrastructure/logging/logstash-config.conf`

Tracing:

- Jaeger Docker overlay: `infrastructure/docker/docker-compose.tracing.yml` (OTLP `4318`)
- Jaeger K8s: `infrastructure/tracing/jaeger-deployment.yaml`
- Services: `src/observability/instrumentation.ts` + `TRACING_ENABLED=true`

Rules:

- Health endpoints should expose enough readiness detail to debug database/message dependencies.
- Startup logs in implemented services currently include readiness mode and check statuses.
- Keep health endpoints stable because Docker, k8s, load tests, and dashboards may depend on them.
- Prometheus scrape paths must match service routes (`/api/v1/*/metrics`).

## CI/CD Workflow

GitHub Actions is the preferred CI/CD path for Droplet deployment:

- `.github/workflows/ci.yml` runs root `pnpm install`, `pnpm run build`, and `pnpm run test`.
- `.github/workflows/docker-deploy.yml` builds five service images using `infrastructure/docker/Dockerfile.service`, pushes them to GHCR, then SSH deploys to k3s via `helm-deploy-ci.sh` + `verify-k8s-readiness.sh` (Phase 4).
- Droplet scripts live in `infrastructure/deploy/` (`helm-rollout.sh`, `run-k8s-migrations.sh`, phase checklists).
- Production Compose overlay: `infrastructure/docker/docker-compose.prod.yml`.
- DigitalOcean production (k3s + Helm): `docs/deployment-k3s-phases.md`.
- DigitalOcean Compose legacy: `docs/deployment-digitalocean-droplet.md`.
- So sánh phương án DO: `docs/digitalocean-production-options.md`.

Required GitHub Actions secrets for deploy:

- `DROPLET_HOST`
- `DROPLET_USER`
- `DROPLET_SSH_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

Jenkins files also exist at service level and under `infrastructure/jenkins`.

Pipeline concept:

1. Checkout.
2. Install dependencies.
3. Build and test.
4. Build Docker image.
5. Push image.
6. Deploy.

Rules:

- If adding new service commands, update Jenkinsfile and infrastructure scripts.
- If changing Docker build context, verify Compose and Jenkins still point to the same context.

## Troubleshooting

### `git status` fails with dubious ownership

If Git says the repo has dubious ownership, avoid changing global Git config unless the user explicitly asks. Work can continue by reading/writing files. Tell the user that git status/diff may be unavailable until they mark the directory safe:

```sh
git config --global --add safe.directory E:/collabspace
```

### NestJS cannot resolve dependencies

Check:

- Provider is listed in the module.
- Imported module exports the provider.
- Injection token matches exactly.
- Path alias works in `tsconfig`.

### gRPC cannot find proto

Check:

- `protoPath` points to `process.cwd()/proto/...`.
- Command is run from the service directory.
- Generated TS files are refreshed when proto changes.
- Package names match proto definitions.

### Database tests behave differently locally

`user-service` uses in-memory repository when `DATABASE_URL` is not set. If a persistence bug only appears with TypeORM, run with `DATABASE_URL` configured and database containers up.
