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

## Lint, format, build, test (toolchain)

### CI gate (chạy từ repo root trước push)

```sh
pnpm run lint            # = lint:ci (alias)
pnpm run lint:ci         # lint:deps → format:check → biome:check → lint:types
pnpm run build           # tsc / nest build — all workspace packages
pnpm run test            # unit tests — all workspace packages
```

`lint:ci` **phải sạch** (0 warnings): Biome dùng `--error-on-warnings`; ESLint dùng `--max-warnings 0` trên mỗi package.

### Lint & format commands

| Command | Mục đích |
|---------|----------|
| `pnpm run lint:deps` | Build `@collabspace/shared` + `@collabspace/nest-auth` (ESLint type-checked cần types) |
| `pnpm run format:check` | Biome format only (read-only) |
| `pnpm run biome:check` | Biome format + lint (`--error-on-warnings`) |
| `pnpm run lint:types` | ESLint type-checked recursive (`pnpm -r run lint`) |
| `pnpm run format` | Biome format write (`services` + `packages`) |
| `pnpm run biome:fix` | Biome format + lint auto-fix (safe; review diff) |

Config: root `biome.json`; ESLint factory `packages/eslint-config/create-type-checked-config.mjs` (`@collabspace/eslint-config`).

### Hai lớp lint

| Lớp | Tool | Phạm vi | Ghi chú |
|-----|------|---------|---------|
| Style / syntax | **Biome** | `services/**`, `packages/**` | `noNonNullAssertion: error` — tránh `!`; dùng guard / narrow type |
| Type-aware | **ESLint** | Per package (`eslint.config.mjs`) | `no-floating-promises: error`; `no-unsafe-*` off ở base; `_` prefix cho unused |

**Per-service vs root:** `pnpm run lint` **trong** `services/<name>` chỉ chạy ESLint package đó. Gate đầy đủ (Biome + ESLint) = **`pnpm run lint` từ repo root**. Per-service `pnpm run format` → `pnpm -w exec biome format --write src test`.

### Type-check / compile

| Scope | Command |
|-------|---------|
| Toàn repo | `pnpm run build` |
| Một service | `cd services/<name> && pnpm run build` |
| Shared packages | `pnpm --filter @collabspace/shared build` |

Không có script `tsc --noEmit` riêng ở root — `build` là compile gate chính.

### Test

| Scope | Command |
|-------|---------|
| Toàn repo | `pnpm run test` |
| Một service | `cd services/<name> && pnpm run test` |
| E2E (auth, user) | `pnpm run test:e2e` trong service đó |

### Pre-commit & CI

- **Pre-commit** (`.githooks/pre-commit`, bật qua `pnpm install` → `prepare`): chặn commit `.env`; `biome check --staged` trên file staged.
- **CI** (`.github/workflows/ci.yml`): job `lint` → `pnpm run lint:ci`; sau đó `build-test` → `build` + `test`.

Chi tiết migration: `docs/tooling/biome-migration.md`. Conventions: `.claude/docs/coding-conventions.md` → Format & lint.

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
- `infrastructure/vault/` — HashiCorp Vault (secrets store: local Compose + K8s prod via ESO)

Rules:

- Do not commit real secrets.
- When adding required env vars, update the matching `.env.example`, config service, Docker Compose file, and README/doc references.
- **Shared secrets (local Docker):** use the same `SERVICE_JWT_SECRET` in `user-service`, `workspace-service`, `task-service`, and `notification-service` `.env` files; align `JWT_SECRET` between `auth-service` and `notification-service`. See `infrastructure/docker/.env.example`.
- **Vault (local dev):** `docker compose -f docker-compose.vault.yml up -d` → `infrastructure/vault/scripts/seed-dev-secrets.ps1` → `sync-env-from-vault.ps1`. See `infrastructure/vault/README.md`.
- **K8s + Vault:** External Secrets Operator manifests in `infrastructure/vault/k8s/`; Helm `global.externalSecrets.enabled: true` skips chart `Secret` templates.
- **Trust boundaries:** `ALLOW_DEV_IDENTITY_HEADERS=true` only in local `.env` for workspace/task/notification direct-port testing; production and gateway traffic require `Authorization: Bearer …`.
- In NestJS services, prefer a configuration wrapper over scattered `process.env` reads when the service already has one. `auth-service` uses `ConfigurationService`; `user-service` currently reads more directly in `main.ts` and module factories.

## HashiCorp Vault (secrets)

Single source for shared dev secrets (`JWT_SECRET`, `SERVICE_JWT_SECRET`, DB/RabbitMQ/Redis passwords). Apps still read `.env` — Vault does not replace Compose `env_file` at runtime unless you sync first.

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

Run core local stack from `infrastructure/docker` (includes hot-reload **and** Prometheus + Grafana via `docker-compose.override.yml` → `include` exporters + monitoring):

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Add Traefik:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.traefik.yml up -d
```

Monitoring-only overlay (skip when using `override.yml` — already included):

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.exporters.yml -f docker-compose.monitoring.yml up -d
```

Full local stack (logging + tracing + gateway):

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
- Kibana: `http://localhost:5601` (chỉ khi bật profile ELK — `docker-compose.logging.yml`; prod K8s dùng Loki)
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
pnpm run lint            # ESLint only — full gate: pnpm run lint from repo root
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
pnpm run lint            # ESLint only — full gate: pnpm run lint from repo root
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
- Update TypeORM entities and class migrations together.
- If changing seed assumptions, update seed scripts and README demo account docs.

## Seed Workflow

Preferred order (loads shared demo data from `scripts/demo-seed-data.json`):

```sh
# Local dev — ts-node (fast iteration)
sh ./scripts/seed.sh

# Same entrypoint as Docker/k8s Jobs (requires pnpm run build in each service first)
SEED_MODE=prod sh ./scripts/seed.sh
# or
sh ./scripts/seed-prod.sh
```

Per service:

```sh
cd services/auth-service && pnpm run seed          # dev
cd services/auth-service && pnpm run seed:prod   # compiled dist/seed/seed.js
```

All services compile seed to **`dist/seed/seed.js`**; images copy `scripts/load-demo-seed-data.js` + `demo-seed-data.json` to `/app/scripts/`.

What gets seeded:

- **auth-service** — roles, permissions, **20** verified demo users
- **user-service** — profiles, preferences, status; optional RabbitMQ replica sync
- **workspace-service** — **4 workspaces**, **9 projects**, members (owner/manager/member mix), **1 pending invitation**
- **task-service** — user replicas, **87 tasks** + event store, **13 comments**
- **notification-service** — **32** sample notifications (UNREAD / READ / ARCHIVED)

Demo accounts after seed:

- `tho@collabspace.dev` / `collabspace123` (platform admin)
- `ngocanh@collabspace.dev` / `collabspace123` (User A — workspace owner)
- `quangtien@collabspace.dev` / `collabspace123` (User B — workspace member)
- `trungtin@collabspace.dev` / `collabspace123` (platform admin)
- `reviewer@collabspace.dev` / `collabspace123` (platform user + workspace member)
- `qa.alice@collabspace.dev` / `collabspace123` (workspace member)
- `dev.bob@collabspace.dev` / `collabspace123` (workspace member)
- `pm.carol@collabspace.dev` / `collabspace123` (workspace manager)
- `designer.dana@collabspace.dev` / `collabspace123` (workspace member)
- `solo.owner@collabspace.dev` / `collabspace123` (Solo workspace owner)
- `viewer.only@collabspace.dev` / `collabspace123` (platform user — no workspace)
- `dev.eve@collabspace.dev` / `collabspace123` (workspace invitation pending)
- `dev.alex@collabspace.dev` / `collabspace123` (workspace member)
- `dev.felix@collabspace.dev` / `collabspace123` (workspace member)
- `dev.gina@collabspace.dev` / `collabspace123` (workspace member)
- `qa.alvin@collabspace.dev` / `collabspace123` (workspace member)
- `pm.helen@collabspace.dev` / `collabspace123` (workspace member)
- `designer.ian@collabspace.dev` / `collabspace123` (workspace member)
- `member.khanh@collabspace.dev` / `collabspace123` (workspace member)
- `viewer.maria@collabspace.dev` / `collabspace123` (platform user — member in some workspaces)

Trạng thái workspace role trong seed hiện tại: **owner/manager/member** (Phase 5).

Run migrations before seeding. Requires Postgres (auth, user, workspace) and MongoDB (task, notification).

## MVP demo verification (E2E script)

After Compose + Traefik + migrate + seed:

```sh
# default BASE_URL=http://localhost/api/v1
./scripts/demo-e2e.sh
```

Windows: `.\scripts\demo-e2e.ps1`. Story and acceptance: `docs/mvp-demo-scope.md`. Infra CI integration: `docs/team/phan-phu-tho-infrastructure-backlog.md` §11.

**k3s production (Droplet):** after CI images include `seed:prod` and the app rollout is healthy, run `bash infrastructure/deploy/run-k8s-seed.sh` on the server. The seed script uses the currently deployed image tag by default; set `IMAGE_TAG=<sha>` only when intentionally seeding a different image. E2E without Brevo: `BASE_URL=http://<host>/api/v1 bash infrastructure/deploy/run-demo-e2e-prod.sh` (OTP via `read-auth-otp-from-outbox.sh`). With Brevo: `bash infrastructure/deploy/configure-prod-brevo.sh` after filling `phase0.env`.

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

Path: `infrastructure/load-testing` — see [infrastructure/load-testing/README.md](../../infrastructure/load-testing/README.md).

**Scenarios (gateway):**

| Script | Purpose |
|--------|---------|
| `k6/scenarios/smoke.js` | Health all 5 app services (low VU) |
| `k6/scenarios/demo-flow.js` | Login seeded demo users → read workspaces/tasks/notifications |

```bash
BASE_URL=http://localhost/api/v1 ./infrastructure/load-testing/run-load-test.sh smoke
BASE_URL=http://<HOST>/api/v1 GRAFANA_URL=http://<HOST>/grafana GRAFANA_PASSWORD=... \
  ./infrastructure/load-testing/run-load-test.sh demo-flow
```

Prod smoke: `infrastructure/deploy/run-k6-smoke-prod.sh`

Legacy per-service scripts under `k6/scripts/` — update when health paths change.

## Observability Workflow

Canonical guide: [docs/observability.md](../../docs/observability.md).

### Kubernetes (Helm — production path)

| Component | Location |
|-----------|----------|
| Prometheus + scrape config | `infrastructure/helm/collabspace/templates/observability/prometheus.yaml` |
| Grafana dashboards (provisioned) | `infrastructure/helm/collabspace/dashboards/` → ConfigMap `collabspace-grafana-dashboards` |
| Loki + Promtail | Helm subcharts in `values.yaml` (`observability.loki`, `observability.promtail`) |
| Network policies (scrape, Loki, Grafana) | `templates/network-policies.yaml` |
| `metricsAuthToken` | `global.secrets.metricsAuthToken` → app secrets + `prometheus-metrics-auth` |

**Grafana folder `CollabSpace`:** Service Health · App Logs (trends only) · Load Test Run.  
**Log tail/search:** Grafana **Explore → Loki** (not embedded log panels).

Datasource UIDs in dashboard JSON: `prometheus`, `loki`.

### Docker Compose (local)

- Prometheus: `infrastructure/monitoring/prometheus.yml`
- Alert rules: `infrastructure/monitoring/alert-rules.yml`
- Alertmanager: `infrastructure/monitoring/alertmanager.yml`
- Overlays: `docker-compose.monitoring.yml`, `docker-compose.exporters.yml`, `docker-compose.logging.yml`, `docker-compose.loadtest.yml`
- Legacy K8s YAML (reference): `infrastructure/k8s/prometheus-deployment.yaml`, `infrastructure/monitoring/grafana-deployment.yaml`
- Sync K8s alert rules (legacy manifests): `infrastructure/k8s/scripts/sync-prometheus-alert-rules.ps1`

### Logging stack choice

- **K8s prod:** Loki + Promtail (enabled in Helm).
- **Docker optional:** Elasticsearch/Kibana (`docker-compose.logging.yml`) — không dùng song song với Loki trên cùng môi trường.

Tracing:

- Jaeger Docker overlay: `infrastructure/docker/docker-compose.tracing.yml` (OTLP `4318`)
- Jaeger K8s: `infrastructure/tracing/jaeger-deployment.yaml`
- Services: `src/observability/instrumentation.ts` + `TRACING_ENABLED=true`

Rules:

- Health endpoints should expose enough readiness detail to debug database/message dependencies.
- Startup logs in implemented services currently include readiness mode and check statuses.
- Health endpoints should expose enough readiness detail to debug database/message dependencies.
- Keep health endpoints stable because Docker, k8s, load tests, and dashboards may depend on them.
- Prometheus scrape paths must match service routes (`/api/v1/*/metrics`).
- Prometheus on K8s must use ServiceAccount `prometheus` and Bearer token when `metricsAuthToken` is set.
- App log investigation: Grafana Explore → Loki; dashboard **App Logs** is trends only.

## CI/CD Workflow

GitHub Actions is the preferred CI/CD path for Droplet deployment:

- `.github/workflows/ci.yml` runs `pnpm run lint:ci` (format + Biome + ESLint), then `pnpm run build` and `pnpm run test`.
- `.github/workflows/docker-deploy.yml` builds five service images using `infrastructure/docker/Dockerfile.service`, pushes them to GHCR, then SSH deploys to k3s via `helm-deploy-ci.sh` + `verify-k8s-readiness.sh` (Phase 4).
- Droplet scripts live in `infrastructure/deploy/` (`helm-rollout.sh`, `run-k8s-migrations.sh`, phase checklists).
- Production Compose overlay: `infrastructure/docker/docker-compose.prod.yml`.
- DigitalOcean production (k3s + Helm): `docs/deployment-k3s-phases.md`.
- DigitalOcean Compose legacy: `docs/deployment-digitalocean-droplet.md`.
- **Droplet VPS troubleshooting (agents):** `.claude/docs/droplet-vps-operations.md` — NODE_PATH, probe mismatch, rollout timeout, monorepo Docker.
- So sánh phương án DO: `docs/digitalocean-production-options.md`.

Required GitHub Actions secrets for deploy:

- `DROPLET_HOST`
- `DROPLET_USER`
- `DROPLET_SSH_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

Pipeline (GitHub Actions):

1. Checkout.
2. `pnpm install` → lint (`lint:ci`) → build + test (`ci.yml`).
3. Build Docker images (`Dockerfile.service`) → push GHCR (`docker-deploy.yml`).
4. SSH Droplet → `helm-deploy-ci.sh` → `verify-k8s-readiness.sh`.

Rules:

- If adding new service commands, update `.github/workflows/ci.yml` and `docker-deploy.yml` path filters when needed.
- If changing Docker build context, verify Compose and `Dockerfile.service` still use the same monorepo layout.

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
