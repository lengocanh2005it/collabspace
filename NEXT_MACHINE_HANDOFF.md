# CollabSpace Next-Machine Handoff

Generated: 2026-05-11

This file is the shortest honest way to get back to full context on a new machine without replaying the whole history.

## Snapshot

- Repository: https://github.com/lengocanh2005it/collabspace.git
- Active working branch before this handoff note: `infra/platform-foundation`
- Branch status before this handoff note: clean, tracking `origin/infra/platform-foundation`
- Commit anchor before this handoff note: `ce00ea02613820bb1e4a3b9511925ac2f61f60a3`
- PR shortcut: https://github.com/lengocanh2005it/collabspace/pull/new/infra/platform-foundation

## What This Branch Already Contains

This branch is the infrastructure/platform foundation pass. The important part is not "some infra files changed". The important part is that the repo was cleaned up into a professional, atomic history.

Committed work on `infra/platform-foundation` before this handoff file:

1. `437bdae` `feat(services): containerize all microservices with multi-stage Dockerfiles`
2. `ee13703` `feat(ci): add Jenkinsfiles and polyglot CI/CD pipeline scripts for all services`
3. `6a7e88c` `feat(gateway): implement Traefik routing, middlewares, and service definitions`
4. `9b742d9` `feat(docker): harden Compose with DB healthchecks and conditional service startup`
5. `fa866a1` `feat(messaging): implement RabbitMQ exchange with complete queue bindings`
6. `e01b17b` `feat(monitoring): configure Prometheus scraping and Grafana service health dashboard`
7. `b8ed6ec` `feat(logging): configure ELK stack with Logstash pipeline for centralized log aggregation`
8. `c632c80` `feat(tracing): configure Jaeger distributed tracing with per-service sampling`
9. `5604c1e` `feat(k8s): add complete Kubernetes platform manifests for collabspace namespace`
10. `7bd9d36` `test(load): add k6 load testing scripts for all five services`
11. `52100b2` `docs: update README with platform architecture, quickstart, and API reference`
12. `ce00ea0` `chore: remove empty docs directory placeholder`

## Project Reality

CollabSpace is currently strong on infrastructure scaffolding and weak on service business logic.

What is done well:

- Docker Compose layout across core, DB, monitoring, logging, tracing, gateway, Jenkins, and load test stacks.
- Traefik API gateway routing for all five services.
- RabbitMQ exchange, queues, and bindings for the main event flows.
- K8s manifests for app services plus StatefulSets for PostgreSQL, MongoDB, Redis, and RabbitMQ.
- Monitoring, logging, tracing, and load-test scaffolding.
- Per-service Dockerfiles, Jenkinsfiles, `.env.example`, and `.dockerignore` files.

What is still fundamentally missing:

- The actual source code / business logic for the services is still mostly absent.
- This repo is still at an infrastructure-shell stage, not at a product-complete stage.

## Non-Negotiable Architectural Truths

- `workspace-service` is the odd one out: Java/Kotlin + Gradle + Flyway on port `8080`.
- The other four services are Node.js services and use port `3000` internally.
- Traefik is the gateway. This is not a Spring Cloud Gateway / Eureka setup.
- Database-per-service is sacred. No cross-database joins, no cross-service foreign keys.
- RabbitMQ exchange: `collabspace_exchange`.
- Key event types: `TASK_ASSIGNED`, `WORKSPACE_INVITED`, `COMMENT_CREATED`.
- Compose files live in `infrastructure/docker`, so relative paths must be written from that directory, not from the repo root.
- The typo `docker-composer.redis.yml` is real. Do not rename it casually unless you intend to update every dependent reference.

## Team / Scope Context

You are operating as **Phan Phu Tho**, the **Infrastructure Engineer**.

That means the primary ownership area is:

- `infrastructure/`
- `api-gateway/`
- Docker Compose files
- Kubernetes manifests
- CI/CD pipelines
- monitoring / logging / tracing
- load testing
- all service Dockerfiles

If you return to active work, do not blur into product/service implementation unless the task explicitly crosses that boundary.

## Files That Matter First

Read these before making any significant decision:

1. `workspace_collaboration_microservices_report.md`
2. `init_doc.md`
3. `init_doc_2.md`
4. `.github/copilot-instructions.md`
5. `README.md`

If something in code conflicts with the spec hierarchy, fix the spec first or make the mismatch explicit.

## New Machine Bootstrap

On the new machine:

```powershell
git clone https://github.com/lengocanh2005it/collabspace.git
cd collabspace
git fetch origin
git checkout infra/platform-foundation
git pull
```

Then open the repo in VS Code and make sure the attached instructions file is available:

- `.github/copilot-instructions.md`

Recommended machine prerequisites:

- Docker Desktop
- Node.js 18+
- Java 17+
- Git
- VS Code

## Useful Commands

Core stack:

```powershell
cd infrastructure/docker
docker-compose -f docker-compose.yml -f docker-compose.db.yml up -d
```

Full local stack:

```powershell
cd infrastructure/docker
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.monitoring.yml -f docker-compose.logging.yml -f docker-compose.tracing.yml -f docker-compose.traefik.yml up -d
```

Quick status checks:

```powershell
docker ps
docker logs <container-name> --tail 100
git status
git log --oneline -12
```

## Important Local-Only Tooling

There is personal dev tooling that was intentionally kept **out of git**.

Local-only folder on the old machine:

- `infrastructure/dev/dev.bat`
- `infrastructure/dev/scripts/dev-mode.ps1`
- `infrastructure/dev/stop_all.bat`
- `infrastructure/dev/restart.bat`
- `infrastructure/dev/clean.bat`

That tooling was ignored through `.git/info/exclude`, not committed to the branch.

Meaning:

- it will **not** arrive automatically on the new machine via git clone
- if you want it on the new machine, you must either copy that folder manually from the old machine or recreate it there

What that tooling does:

- starts infra and service windows from one entry point
- gives a fast `-Status` dashboard
- has `-Infra`, `-InfraDown`, `-InfraReset`, `-Db`, `-Migrate`, `-Seed`
- auto-skips services with no source code
- runs `workspace-service` with `gradlew.bat bootRun`
- runs Node services with `npm run start:dev`
- supports an aggregated error watcher

If you need to recreate it from scratch on the new machine, the inputs are:

1. `DEV_MODE_BLUEPRINT.md`
2. the dev-mode section inside `.github/copilot-instructions.md`

## Current Open Fronts

If you resume active repo work, the likely next serious fronts are:

1. service source code implementation
2. observability integration inside the actual services
3. CI/CD validation against real service code instead of placeholders
4. K8s runtime validation on an actual cluster
5. documentation expansion under `docs/`

This is not a warning to reduce scope. It is a reminder of where the real unfinished surface still is.

## If You Need to Rebuild Context Fast

Paste something like this into Copilot on the new machine:

```text
Read NEXT_MACHINE_HANDOFF.md, README.md, workspace_collaboration_microservices_report.md, init_doc.md, init_doc_2.md, and .github/copilot-instructions.md. I am Phan Phu Tho, the Infrastructure Engineer. Keep work scoped to infrastructure/platform unless the task explicitly crosses that line. Start by confirming branch status, then continue from infra/platform-foundation without re-explaining the repo to me.
```

## Bottom Line

You are not returning to a messy unknown state.

- the repo branch is structured
- the history is atomic
- the infra baseline is substantial
- the remaining work is mostly beyond scaffolding and into actual service implementation

If you want the old-machine personal dev tooling on the new machine, do not forget that it is outside git and must be copied or recreated.