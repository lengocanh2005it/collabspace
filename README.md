# CollabSpace

**A workspace collaboration management platform** — a mini Notion/Slack/Jira hybrid built with microservices architecture.

**Product features & status:** [docs/features.md](docs/features.md) · **MVP demo scope:** [docs/mvp-demo-scope.md](docs/mvp-demo-scope.md) · **API routes:** [docs/api-routes.md](docs/api-routes.md)

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
         │   PostgreSQL   │     MongoDB        Redis/Mongo
         │    :5432       │     :27017          :6379
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

> **CRITICAL**: `workspace-service` runs on port **8080** (Java/Kotlin), not 3000 like Node.js services.

## Infrastructure Components

| Component | Image | Port(s) | Purpose |
|-----------|-------|---------|---------|
| Traefik | traefik:v2.10 | 80, 443, 8080 | API Gateway, routing |
| RabbitMQ | rabbitmq:3-management | 5672, 15672 | Async event bus |
| Redis | redis:7 | 6379 | Caching, notifications |
| PostgreSQL | postgres:15 | 5432 | Auth, User, Workspace DBs |
| MongoDB | mongo:6 | 27017 | Task service |
| Prometheus | prom/prometheus | 9090 | Metrics collection |
| Grafana | grafana/grafana | 3005 | Metrics visualization |
| Elasticsearch | elasticsearch:8.8.2 | 9200 | Log storage |
| Logstash | logstash:8.8.2 | 5044 | Log pipeline |
| Kibana | kibana:8.8.2 | 5601 | Log visualization |
| Jaeger | jaegertracing/all-in-one:1.41 | 16686 | Distributed tracing |
| Jenkins | jenkins/jenkins:lts | 8081 | CI/CD |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Java 17+ (for workspace-service local development)

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

# With logging (ELK Stack)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.logging.yml up -d

# With tracing (Jaeger)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.tracing.yml up -d

# With API Gateway (Traefik)
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml up -d

# Full stack (everything)
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
   # Run the env setup script
   ./scripts/env-setup.sh
   
   # Or manually copy .env.example files
   cp services/auth-service/.env.example services/auth-service/.env
   # ... repeat for other services
   ```

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

After seeding `auth-service` and `user-service`, these demo accounts are available:

| Name | Email | Role | Password |
|------|-------|------|----------|
| Phan Phu Tho | `tho@collabspace.dev` | `admin` | `collabspace123` |
| Le Ngoc Anh | `ngocanh@collabspace.dev` | `member` | `collabspace123` |
| Ngo Quang Tien | `quangtien@collabspace.dev` | `member` | `collabspace123` |
| Vo Trung Tin | `trungtin@collabspace.dev` | `member` | `collabspace123` |
| Demo Reviewer | `reviewer@collabspace.dev` | `viewer` | `collabspace123` |

Seed order for aligned demo data:

```powershell
cd services/auth-service
npm run seed

cd ../user-service
npm run seed
```

Or run the shell wrappers that are easier to reuse in Docker images and CI jobs:

```sh
sh ./services/auth-service/scripts/seed.sh
sh ./services/user-service/scripts/seed.sh

# seed both in the correct order
sh ./scripts/seed.sh
```

## Team

| Member | Name | Role | Responsibilities |
|--------|------|------|-----------------|
| Member 1 | Phan Phu Tho | Infrastructure Engineer | Docker, K8s, CI/CD, Monitoring, Tracing, Logging, API Gateway |
| Member 2 | Le Ngoc Anh | Auth & User Service | JWT auth, RBAC, Profile APIs |
| Member 3 | Ngo Quang Tien | Workspace Service | Workspace CRUD, Member invitations |
| Member 4 | Vo Trung Tin | Task & Notification Service | Task CRUD, Comments, Events |

## API Routes

Route index by service (auth, user, workspace, task, notification), gateway headers, and gRPC entry points: **[docs/api-routes.md](docs/api-routes.md)**.

Request/response contracts and event payloads: [`.claude/docs/service-contracts.md`](.claude/docs/service-contracts.md).

## Monitoring & Observability

### Dashboards

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | http://localhost:3005 | Metrics dashboards |
| Prometheus | http://localhost:9090 | Metrics queries |
| Kibana | http://localhost:5601 | Log exploration |
| Jaeger | http://localhost:16686 | Trace analysis |
| Traefik | http://localhost:8080 | API Gateway dashboard |
| RabbitMQ | http://localhost:15672 | Message queue management |

### Default Credentials (Development Only)

| Service | Username | Password |
|---------|----------|----------|
| Grafana | admin | collabspace-grafana |
| RabbitMQ | guest | guest |
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

Chart docs: [infrastructure/helm/README.md](infrastructure/helm/README.md). Legacy plain YAML: [infrastructure/k8s/README.md](infrastructure/k8s/README.md).

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
| elasticsearch | 1 | 1Gi | 2Gi | 500m | 1000m |
| kibana | 1 | 512Mi | 1Gi | 250m | 500m |
| jaeger | 1 | 256Mi | 512Mi | 100m | 250m |

## CI/CD Pipeline

Jenkins pipeline stages:
1. **Checkout** - Clone repository
2. **Build & Test** - Install dependencies, run tests
3. **Build Docker Image** - Create container image
4. **Push Docker Image** - Push to registry
5. **Deploy** - Update running containers

Jenkins is available at http://localhost:8081 when running docker-compose.jenkins.yml.

## Project Structure

```
collabspace/
├── services/
│   ├── auth-service/        # Authentication (NestJS + TypeORM)
│   ├── user-service/        # User profiles (NestJS + TypeORM)
│   ├── workspace-service/   # Workspaces (Java/Kotlin + Flyway)
│   ├── task-service/        # Tasks (Node.js + MongoDB)
│   └── notification-service/# Notifications (Node.js + Redis)
├── infrastructure/
│   ├── docker/              # Docker Compose files
│   ├── helm/                # Helm umbrella chart (preferred for K8s)
│   ├── k8s/                 # Legacy Kubernetes manifests
│   ├── monitoring/          # Prometheus + Grafana configs
│   ├── logging/             # ELK Stack configs
│   ├── tracing/             # Jaeger configs
│   ├── rabbitmq/            # RabbitMQ setup
│   ├── redis/               # Redis setup
│   ├── jenkins/             # CI/CD configs
│   └── load-testing/        # k6 load tests
├── api-gateway/             # Traefik configuration
├── scripts/                 # Utility scripts
└── docs/                    # Documentation
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
**Last Updated**: 2026-05-11

---

## 🏗 Platform Foundation V2 (Convergence Hardening)

The infrastructure has been converged with the service implementations (`auth`, `user`, `task`, `notification` on NestJS, `workspace` on Java).

### Key Upgrades:
- **API Gateway**: Migrated all routes to `/api/v1/*` with true `forward-auth` middleware leveraging `auth-service`.
- **Docker Tooling**: Upgraded to Node 20, NestJS builds, and `pnpm` where applicable. Restart policies and memory limits applied.
- **K8s Manifests**: Real health check probes (`/api/v1/*/health`), HPAs added, and shared ConfigMaps implemented.
- **Observability**: Prometheus metrics enabled with Node exporters (Postgres, Redis, MongoDB). Grafana dashboards auto-provisioned.
- **Dev Tooling**: Re-created `infrastructure/dev/` tooling (`dev.bat`, `stop_all.bat`, `dev-mode.ps1`) for frictionless local startup.
