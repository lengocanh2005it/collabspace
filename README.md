# CollabSpace

**A workspace collaboration management platform** — a mini Notion/Slack/Jira hybrid built with microservices architecture.

**Product features & status:** [docs/features.md](docs/features.md) · **MVP demo scope:** [docs/mvp-demo-scope.md](docs/mvp-demo-scope.md) · **API routes:** [docs/api-routes.md](docs/api-routes.md) · **URLs (API/Swagger/Grafana):** [docs/service-urls.md](docs/service-urls.md) · **App backlog:** [docs/team/application-backlog.md](docs/team/application-backlog.md) · **Infra backlog:** [docs/team/phan-phu-tho-infrastructure-backlog.md](docs/team/phan-phu-tho-infrastructure-backlog.md)

**MVP backend (2026-06):** Luồng demo 7 bước **Done** (API + `scripts/demo-e2e`). **OpenAPI 5/5 Done** (Swagger + response schemas, public qua Traefik). Còn lại chủ yếu: frontend, e2e per service, CI smoke, workspace activity feed.

## Architecture

```
                     Client (TBD)
                         │
                  ┌──────┴──────┐
                  │   Traefik   │  :80 / :443 / :8080 (dashboard)
                  │  API Gateway │
                  └──────┬──────┘
                         │  PathPrefix routing
          ┌─────┬───────┼───────┬───────────┐
          │     │       │       │           │
      ┌───┴──┐ ┌┴────┐ ┌┴─────┐ ┌┴───────┐ ┌┴─────────────┐
      │ Auth │ │User │ │Work- │ │ Task   │ │Notification  │
      │:3000 │ │:3000│ │space │ │:3000   │ │   :3000      │
      │      │ │     │ │:8080 │ │        │ │              │
      └──┬───┘ └──┬──┘ └──┬───┘ └───┬────┘ └──────┬───────┘
         │        │       │         │              │
         │   PostgreSQL   │     MongoDB        MongoDB
         │    :5432       │     :27017         :27017
         │                │                    (task + notification)
         │    Redis :6379 (auth OTP/session)
         │                │
         └────────────────┘
                  ↕ (RabbitMQ :5672 / :15672)
             Events: TASK_ASSIGNED, WORKSPACE_INVITED, COMMENT_CREATED
```

## Services

| Service | Tech Stack | Port | Database | Health Endpoint |
|---------|-----------|------|----------|-----------------|
| **auth-service** | NestJS + TypeORM | 3000 | PostgreSQL (`collabspace_auth`) | `/api/v1/auth/health` |
| **user-service** | NestJS + TypeORM | 3000 | PostgreSQL (`collabspace_user`) | `/api/v1/users/health` |
| **workspace-service** | NestJS + TypeORM | **8080** | PostgreSQL (`collabspace_workspace`) | `/api/v1/workspaces/health/ready` |
| **task-service** | NestJS + MongoDB | 3000 | MongoDB (`collabspace_task`) | `/api/v1/tasks/health/ready` |
| **notification-service** | NestJS + MongoDB | 3000 | MongoDB | `/api/v1/notifications/health/ready` |

> **CRITICAL**: `workspace-service` runs on port **8080**, not 3000 like the other NestJS services.

## Infrastructure Components

| Component | Image | Port(s) | Purpose |
|-----------|-------|---------|---------|
| Traefik | traefik:v2.10 | 80, 443, 8080 | API Gateway, routing |
| RabbitMQ | rabbitmq:3-management | 5672, 15672 | Async event bus |
| Redis | redis:7 | 6379 | Caching, notifications |
| PostgreSQL | postgres:15 | 5432 | Auth, User, Workspace DBs |
| MongoDB | mongo:6 | 27017 | Task service |
| Prometheus | prom/prometheus | 9090 | Metrics collection |
| Grafana | grafana/grafana | 3005 | Dashboards (local Compose) |
| Loki + Promtail | Helm subcharts (K8s) | 3100 | **Log aggregation (production path)** |
| Jaeger | jaegertracing/all-in-one:1.41 | 16686 | Distributed tracing (optional profile) |
| HashiCorp Vault | hashicorp/vault:1.17 | 8200 (local); in-cluster (K8s, nội bộ) | **Secrets store** — KV `secret/collabspace/<env>` + ESO → K8s `Secret` — `infrastructure/vault/` |

**Logging:** K8s/Helm dùng **Loki + Promtail** (không Elasticsearch). Docker Compose có profile **ELK tùy chọn** (`docker-compose.logging.yml`) — chỉ local dev, không dùng trên prod.

**Secrets:** K8s prod dùng **HashiCorp Vault + External Secrets Operator** (Phase 2 deploy). Local: `docker-compose.vault.yml` hoặc `.env` tay — xem [infrastructure/vault/README.md](infrastructure/vault/README.md).

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (Node 20 recommended for Docker images)
- pnpm 8+ — **pnpm workspace** at repo root (`package.json`, `pnpm-workspace.yaml`, `packages/shared`)

### Docker Compose Commands

```powershell
# Navigate to docker directory
cd collabspace/infrastructure/docker

# Core services + databases
docker-compose -f docker-compose.yml -f docker-compose.db.yml up -d

# Full local dev stack (with port mappings)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d

# With monitoring (Prometheus + Grafana)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.monitoring.yml up -d

# Optional: legacy ELK logging profile (local only — prod uses Loki on K8s)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.logging.yml up -d

# With tracing (Jaeger)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.tracing.yml up -d

# With API Gateway (Traefik)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml up -d

# With Vault (secrets — khuyến nghị; khớp luồng K8s prod)
docker compose -f docker-compose.vault.yml up -d

# Full stack (monitoring + optional ELK + tracing + gateway)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.monitoring.yml -f docker-compose.logging.yml -f docker-compose.tracing.yml -f docker-compose.traefik.yml up -d
```

### Development Setup

1. **Clone the repository**
   ```powershell
   git clone <repository-url>
   cd collabspace
   ```

2. **Set up environment files**
   ```powershell
   # Khuyến nghị — HashiCorp Vault dev (cùng luồng secret với K8s prod)
   cd infrastructure/docker
   docker compose -f docker-compose.vault.yml up -d
   cd ../..
   .\infrastructure\vault\scripts\seed-dev-secrets.ps1
   .\infrastructure\vault\scripts\sync-env-from-vault.ps1

   # Hoặc — copy templates thủ công (nhanh, không qua Vault)
   # ./scripts/env-setup.sh
   ```
   See [infrastructure/vault/README.md](infrastructure/vault/README.md). **K8s prod:** Vault + External Secrets Operator (Phase 2).

3. **Initialize databases**
   ```powershell
   ./scripts/init-db.sh
   ```

4. **Run migrations**
   ```powershell
   ./scripts/migrate.sh
   ```

5. **Seed data (optional)**
   ```powershell
   ./scripts/seed.sh
   ```

### Seeded Development Accounts

After `./scripts/seed.sh`, **12 accounts** (password `collabspace123` for all) and **4 workspaces** are available. Source of truth: [`scripts/demo-seed-data.json`](scripts/demo-seed-data.json).

| Email | Platform role | Workspace memberships | Use for |
|-------|---------------|----------------------|---------|
| `tho@collabspace.dev` | admin | Infra Ops **owner** | Platform admin + ops workspace |
| `trungtin@collabspace.dev` | admin | Infra Ops member | `/admin/*` UI, broadcast |
| `ngocanh@collabspace.dev` | member | Demo **owner**, Product Lab + Infra Ops member | **User A** MVP flow |
| `quangtien@collabspace.dev` | member | Demo + Product Lab **owner** | **User B**, second workspace owner |
| `reviewer@collabspace.dev` | viewer | Demo member | Read-only platform + browse workspace |
| `qa.alice@collabspace.dev` | member | Demo member | QA / board regression |
| `dev.bob@collabspace.dev` | member | Product Lab member | Assignee + mentions |
| `pm.carol@collabspace.dev` | member | Demo + Product Lab member | Unassigned tasks, triage |
| `designer.dana@collabspace.dev` | member | Product Lab member | Design-system tasks |
| `solo.owner@collabspace.dev` | member | Solo Sandbox **owner** | Single-user workspace |
| `viewer.only@collabspace.dev` | viewer | *(none)* | Expect 403 on workspace APIs |
| `dev.eve@collabspace.dev` | member | *(pending invite)* | `/invitations/me` accept flow |

**Workspaces:** CollabSpace Demo · Product Lab · Infra Ops · Solo Sandbox  
**Data:** 6 projects · 15 tasks · 4 comments · 8 notifications · 1 pending invitation

**Roles:** Platform `admin` | `member` | `viewer` (auth) — tách khỏi workspace `owner` | `manager` | `member`. Chi tiết: [docs/roles-and-permissions.md](docs/roles-and-permissions.md).

Source of truth: [`scripts/demo-seed-data.json`](scripts/demo-seed-data.json).

Seed order (required):

```powershell
./scripts/seed.sh
```

Or manually:

```powershell
cd services/auth-service; pnpm run seed
cd ../user-service; pnpm run seed
cd ../workspace-service; pnpm run seed
cd ../task-service; pnpm run seed
cd ../notification-service; pnpm run seed
```

Prerequisites: run `./scripts/migrate.sh` first; Postgres + MongoDB must be reachable via each service `.env`.

### Monorepo build & test (pnpm workspace)

From repo root (builds `packages/shared` + all services):

```powershell
pnpm install
pnpm run build
pnpm run test
```

Or per service: `cd services/<name> && pnpm run build && pnpm run test`.

### Lint & format (Biome + ESLint)

From **repo root** (same gate as CI):

```powershell
pnpm run lint            # format:check + Biome lint + ESLint type-checked
pnpm run format          # Biome write (services + packages)
pnpm run biome:fix       # Biome auto-fix (format + safe lint fixes)
```

Inside a single service, `pnpm run lint` runs **ESLint only** for that package; `pnpm run format` delegates to root Biome. Always run **`pnpm run lint` from root** before opening a PR.

Pre-commit (after `pnpm install`): `biome check --staged` on staged files. Details: [docs/tooling/biome-migration.md](docs/tooling/biome-migration.md), [.claude/docs/development-workflows.md](.claude/docs/development-workflows.md).

### Verify MVP demo (E2E script)

Requires Docker stack with **Traefik** + databases + migrations + seed:

```powershell
# Full stack example (see Docker Compose section above)
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.traefik.yml up -d
cd ../..
./scripts/migrate.sh
./scripts/seed.sh

# 7-step story via gateway (default BASE_URL=http://localhost/api/v1)
./scripts/demo-e2e.sh
# Windows: .\scripts\demo-e2e.ps1
```

Details: [docs/mvp-demo-scope.md](docs/mvp-demo-scope.md). CI integration: [infra backlog § smoke](docs/team/phan-phu-tho-infrastructure-backlog.md#11-post-deploy-smoke).

## Team

| Member | Name | Role | Responsibilities | Backlog |
|--------|------|------|------------------|---------|
| Member 1 | Phan Phú Thọ | Infrastructure Engineer | Docker, K8s, CI/CD, secrets, backup, monitoring | [infra backlog](docs/team/phan-phu-tho-infrastructure-backlog.md) |
| Member 2 | Lê Ngọc Anh | Auth & User · DO Deploy · HTTPS | JWT auth, OTP, profile, user directory, gRPC; **DigitalOcean Droplet deploy** (k3s, Helm, Vault+ESO, verify prod); **Domain + HTTPS/TLS** (`collabspace.ngocanh2005it.site`, Let's Encrypt ACME, HTTP→HTTPS redirect, CORS) | [app backlog § Anh](docs/team/application-backlog.md#lê-ngọc-anh--auth-user-do-droplet) |
| Member 3 | Ngô Quang Tiến | Workspace Service | Workspace, project, invite, membership, task↔workspace integration | [app backlog § Tiến](docs/team/application-backlog.md#ngô-quang-tiến--workspace--task-integration) |
| Member 4 | Võ Trung Tín | Task & Notification Service | Task, board, activity feed, comments, notifications; lead `demo-e2e` (Done) | [app backlog § Tín](docs/team/application-backlog.md#võ-trung-tín--task--notification--demo) |

## API Routes

Route index by service (auth, user, workspace, task, notification), gateway headers, and gRPC entry points: **[docs/api-routes.md](docs/api-routes.md)**.

Request/response contracts and event payloads: [`.claude/docs/service-contracts.md`](.claude/docs/service-contracts.md).

### OpenAPI (Swagger UI)

**Trạng thái:** ✅ 5/5 service — UI tại `/swagger`, request/response schema (`@ApiOkResponse` / `@ApiCreatedResponse`). Bảng URL đầy đủ (prod Droplet, local, Grafana): **[docs/service-urls.md](docs/service-urls.md)**.

**K8s / Traefik gateway** (`gateway.swagger.expose: true`):

| Service | Swagger URL |
|---------|---------------|
| auth-service | https://collabspace.ngocanh2005it.site/swagger/auth |
| user-service | https://collabspace.ngocanh2005it.site/swagger/user |
| workspace-service | https://collabspace.ngocanh2005it.site/swagger/workspace |
| task-service | https://collabspace.ngocanh2005it.site/swagger/task |
| notification-service | https://collabspace.ngocanh2005it.site/swagger/notification |

**Docker local** (trực tiếp cổng mapped):

| Service | Swagger URL |
|---------|---------------|
| auth-service | http://localhost:3000/swagger |
| user-service | http://localhost:3001/swagger |
| workspace-service | http://localhost:3002/swagger |
| task-service | http://localhost:3003/swagger |
| notification-service | http://localhost:3004/swagger |

Protected routes: **Authorize** → Bearer JWT. Internal S2S routes (user/workspace): Service JWT (`Authorization: Bearer …`).

## Monitoring & Observability

Hướng dẫn đầy đủ: **[docs/observability.md](docs/observability.md)**.

### Local Docker Compose

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | http://localhost:3005 | Metrics dashboards |
| Prometheus | http://localhost:9090 | Metrics queries |
| Jaeger | http://localhost:16686 | Trace analysis (tracing profile) |
| Traefik | http://localhost:8080 | API Gateway dashboard |
| RabbitMQ | http://localhost:15672 | Message queue management |
| Kibana | http://localhost:5601 | Logs — **chỉ khi bật profile ELK** (`docker-compose.logging.yml`) |

Log trên Compose: container `stdout` + tùy chọn profile ELK. **Không** dùng ELK trên K8s prod.

### Kubernetes (Helm) — đường chính

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | https://collabspace.ngocanh2005it.site/grafana/ | Folder **CollabSpace**: Service Health, App Logs, Load Test Run |
| Prometheus | in-cluster `:9090` | Scrape app + Traefik (`metricsAuthToken`) |
| Loki | in-cluster `:3100` | Logs — tail/search qua **Grafana Explore** |

**Đọc log chi tiết:** Explore → Loki → `{namespace="collabspace", app="auth-service"}` (không tail trong dashboard App Logs).

### Load testing (k6)

```bash
BASE_URL=http://localhost/api/v1 ./infrastructure/load-testing/run-load-test.sh smoke
```

Xem [infrastructure/load-testing/README.md](infrastructure/load-testing/README.md).

### Default Credentials (Development Only)

| Service | Username | Password | Ghi chú |
|---------|----------|----------|---------|
| Grafana (Docker local) | admin | collabspace-grafana | `docker-compose.monitoring.yml` |
| Grafana (K8s prod) | admin | từ PVC/Helm | Có thể khác chart default — [observability.md](docs/observability.md) |
| RabbitMQ | guest | guest | |
| Redis | - | collabspace123 |

> **WARNING**: Change all credentials for production deployments!

## Kubernetes Deployment (Helm)

### Prerequisites
- Kubernetes cluster (1.24+)
- Helm 3.12+ and `kubectl`
- Persistent volume provisioner (for Bitnami PVCs)
- Container images `collabspace/*` available to the cluster

### Deploy with Helm

```bash
# Recommended — umbrella chart (Bitnami data stores + Traefik + apps)
./infrastructure/helm/scripts/install.sh

# Local minikube/kind (lighter)
./infrastructure/helm/scripts/install.sh --local

# Check status
kubectl get pods -n collabspace
kubectl get svc traefik -n collabspace
```

Chart docs: [infrastructure/helm/README.md](infrastructure/helm/README.md). **Production DO (k3s):** [docs/deployment-k3s-phases.md](docs/deployment-k3s-phases.md). So sánh phương án: [docs/digitalocean-production-options.md](docs/digitalocean-production-options.md). Legacy Compose Droplet: [docs/deployment-digitalocean-droplet.md](docs/deployment-digitalocean-droplet.md). Legacy plain YAML: [infrastructure/k8s/README.md](infrastructure/k8s/README.md).

### K8s Resource Summary

| Component | Replicas | Memory Request | Memory Limit | CPU Request | CPU Limit |
|-----------|----------|----------------|--------------|-------------|-----------|
| auth-service | 2 | 128Mi | 256Mi | 100m | 250m |
| user-service | 2 | 128Mi | 256Mi | 100m | 250m |
| workspace-service | 2 | 256Mi | 512Mi | 200m | 500m |
| task-service | 2 | 128Mi | 256Mi | 100m | 250m |
| notification-service | 2 | 128Mi | 256Mi | 100m | 250m |
| traefik | 2 | 64Mi | 128Mi | 100m | 200m |
| grafana | 1 | 128Mi | 256Mi | 100m | 200m |
| prometheus | 1 | 256Mi | 512Mi | 100m | 500m |
| loki | 1 | 128Mi | 256Mi | 100m | 250m |
| promtail | 1 | 64Mi | 128Mi | 50m | 100m |
| vault | 1 | 128Mi | 256Mi | 100m | 250m |
| jaeger | 1 | 256Mi | 512Mi | 100m | 250m |

## CI/CD Pipeline

GitHub Actions workflows:

1. `.github/workflows/ci.yml` — `lint` (`pnpm run lint:ci`) then build + test on PRs and `main`.
2. `.github/workflows/docker-deploy.yml` — build five service images, push GHCR; **Helm deploy on k3s Droplet** via SSH (`infrastructure/deploy/helm-deploy-ci.sh`).

Lộ trình production: [docs/deployment-k3s-phases.md](docs/deployment-k3s-phases.md). URL prod/local: [docs/service-urls.md](docs/service-urls.md). Compose legacy: [docs/deployment-digitalocean-droplet.md](docs/deployment-digitalocean-droplet.md).

## Project Structure

```
collabspace/
├── package.json             # pnpm workspace root (build/test/lint/format)
├── biome.json               # Biome format + lint (services + packages)
├── pnpm-workspace.yaml
├── CLAUDE.md                # Primary agent guide (Cursor / Claude Code)
├── AGENTS.md                # Cross-tool agent index
├── .github/workflows/       # CI: test (ci.yml) + GHCR build & k3s deploy (docker-deploy.yml)
├── .claude/                 # Agent docs, skills, rules, subagents
├── packages/
│   └── shared/              # @collabspace/shared — event types & contracts
├── services/
│   ├── auth-service/        # Auth (NestJS + TypeORM + Redis + gRPC)
│   ├── user-service/        # Profiles (NestJS + TypeORM + gRPC)
│   ├── workspace-service/   # Workspace, project, invite (NestJS + TypeORM, port 8080)
│   ├── task-service/        # Tasks, comments, board (NestJS + CQRS + MongoDB)
│   └── notification-service/# Notifications (NestJS + CQRS + MongoDB)
├── infrastructure/
│   ├── docker/              # Docker Compose (app, db, traefik, monitoring, vault, logging profile, …)
│   ├── deploy/              # Droplet/k3s scripts (Phase 0–3, helm-deploy-ci, seed/migrate prod)
│   ├── helm/                # Umbrella chart `collabspace` (preferred K8s) + Grafana dashboards
│   ├── vault/               # HashiCorp Vault (local dev + ESO manifests)
│   ├── k8s/                 # Legacy plain Kubernetes YAML (reference)
│   ├── monitoring/          # Prometheus alert rules + Grafana JSON (sync from helm/dashboards)
│   ├── backup/              # Backup/restore scripts
│   ├── load-testing/        # k6 scenarios (smoke, demo-flow)
│   ├── tracing/             # Jaeger / OTLP configs (optional Compose profile)
│   ├── rabbitmq/            # RabbitMQ setup
│   ├── redis/               # Redis setup
│   ├── resilience/          # Readiness drills, degradation helpers
│   ├── chaos/               # Chaos / stop-service drills
│   └── dev/                 # Local dev helpers (dev.bat, dev-mode.ps1)
├── api-gateway/             # Traefik static + dynamic config (forward-auth, routes)
├── scripts/                 # Root shortcuts: migrate, seed, demo-e2e
└── docs/                    # features, deploy, observability, service-urls, team/, runbooks/
```

## Event-Driven Architecture

Services communicate asynchronously via RabbitMQ:

```
┌─────────────────┐      ┌─────────────────────────┐      ┌───────────────────┐
│  Task Service   │ ──── │   collabspace_exchange  │ ──── │ Notification Svc  │
│                 │      │      (direct type)       │      │                   │
│  Publishes:     │      │                         │      │  Consumes:        │
│  - TASK_ASSIGNED│      │  Routing Keys:          │      │  - task_assigned  │
│  - COMMENT_     │      │  - task_assigned        │      │  - workspace_     │
│    CREATED      │      │  - workspace_invited    │      │    invited        │
└─────────────────┘      │  - comment_created      │      │  - comment_created│
                         └─────────────────────────┘      └───────────────────┘
                                     ▲
                                     │
                         ┌───────────┴───────────┐
                         │  Workspace Service    │
                         │                       │
                         │  Publishes:           │
                         │  - WORKSPACE_INVITED  │
                         └───────────────────────┘
```

## License

This project is for educational purposes.

---

**Infrastructure Engineer**: Phan Phu Tho  
**Auth & DO Deploy & HTTPS**: Lê Ngọc Anh  
**Last Updated**: 2026-06-15

---

## 🏗 Platform Foundation V2 (Convergence Hardening)

All five application services run on **NestJS** (`workspace-service` listens on port **8080**). **Secrets:** HashiCorp Vault + ESO trên K8s prod ([infrastructure/vault/](infrastructure/vault/)); Vault HA + rotation operational — [docs/team/phan-phu-tho-infrastructure-backlog.md](docs/team/phan-phu-tho-infrastructure-backlog.md).

### Key Upgrades:
- **API Gateway**: Routes `/api/v1/*` with `forward-auth` via `auth-service`; internal S2S paths blocked at gateway.
- **Monorepo**: pnpm workspace + `packages/shared` (`@collabspace/shared` event contracts).
- **MVP automation**: `scripts/demo-e2e.sh` / `.ps1` — 7-step story through Traefik.
- **Docker Tooling**: Node 20, NestJS builds, `pnpm`. Restart policies and memory limits applied.
- **K8s / Helm**: Health probes, HPAs, ConfigMaps, Vault ESO scaffold (`infrastructure/vault/`).
- **Observability**: Prometheus + Grafana + Loki (K8s Helm); Docker profile ELK tùy chọn trong `infrastructure/docker/docker-compose.logging.yml`; k6 — [docs/observability.md](docs/observability.md).
- **Dev Tooling**: `infrastructure/dev/` (`dev.bat`, `stop_all.bat`, `dev-mode.ps1`).
