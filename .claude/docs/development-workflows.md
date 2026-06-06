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
- `pnpm` for service dependency management.
- Java 17+ only if implementing/running `workspace-service` as Java/Kotlin.

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

Rules:

- Do not commit real secrets.
- When adding required env vars, update the matching `.env.example`, config service, Docker Compose file, and README/doc references.
- In NestJS services, prefer a configuration wrapper over scattered `process.env` reads when the service already has one. `auth-service` uses `ConfigurationService`; `user-service` currently reads more directly in `main.ts` and module factories.

## Docker Compose

Run core local stack from `infrastructure/docker`:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Add Traefik:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.traefik.yml up -d
```

Add monitoring:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.monitoring.yml up -d
```

Full local stack:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.monitoring.yml -f docker-compose.logging.yml -f docker-compose.tracing.yml -f docker-compose.traefik.yml up -d
```

Important local URLs:

- Auth service direct: `http://localhost:3000/api/v1/auth/health`
- User service direct: `http://localhost:3001/api/v1/users/health`
- Workspace direct: `http://localhost:3002/workspaces/health` once implemented
- Task direct: `http://localhost:3003/tasks/health` once implemented
- Notification direct: `http://localhost:3004/notifications/health` once implemented
- Grafana: `http://localhost:3005`
- Prometheus: `http://localhost:9090`
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

Preferred order:

```sh
cd services/auth-service
pnpm run seed

cd ../user-service
pnpm run seed
```

Root helper:

```sh
sh ./scripts/seed.sh
```

Demo accounts after seed:

- `tho@collabspace.dev` / `collabspace123`
- `ngocanh@collabspace.dev` / `collabspace123`
- `quangtien@collabspace.dev` / `collabspace123`
- `trungtin@collabspace.dev` / `collabspace123`
- `reviewer@collabspace.dev` / `collabspace123`

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
- Grafana deployment: `infrastructure/monitoring/grafana-deployment.yaml`
- Grafana dashboard: `infrastructure/monitoring/grafana-dashboards/service-health.json`

Logging:

- Elasticsearch: `infrastructure/logging/elasticsearch-deployment.yaml`
- Kibana: `infrastructure/logging/kibana-deployment.yaml`
- Logstash: `infrastructure/logging/logstash-config.conf`

Tracing:

- Jaeger config/deployment under `infrastructure/tracing`

Rules:

- Health endpoints should expose enough readiness detail to debug database/message dependencies.
- Startup logs in implemented services currently include readiness mode and check statuses.
- Keep health endpoints stable because Docker, k8s, load tests, and dashboards may depend on them.

## CI/CD Workflow

Jenkins files exist at service level and under `infrastructure/jenkins`.

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

