---
name: local-dev-verify
description: Choose and run the right local build, test, migration, seed, Docker, health check, or troubleshooting workflow for CollabSpace. Use when verifying changes, debugging local setup, checking health endpoints, or preparing a demo.
---

# Local Dev Verify Skill

Use this skill to verify code changes and local runtime behavior.

## Required Context

Read:

- `.claude/docs/development-workflows.md`
- **DigitalOcean production / migration:** `.claude/docs/doks-operations.md` (Droplet k3s ops today; DOKS migration, CI deploy, rollout timeout, probe 404)
- Target service `package.json`
- Relevant Docker Compose files under `infrastructure/docker`

## Decide Verification Scope

For docs-only changes:

- No build/test required unless docs include generated examples or commands that need validation.

When **code** changes verify commands, ports, compose files, or health URLs:

- Update this `SKILL.md` and `.claude/docs/development-workflows.md` in the same PR.
- See `.claude/rules/docs-and-skills-sync.md`.

For TypeScript compile/module changes:

- Run target service `pnpm run build`.

For business logic changes:

- Run target service `pnpm run test`.

For route/validation/bootstrap changes:

- Run target service `pnpm run test:e2e` when dependencies are available.

For schema changes:

- Run migration if DB is available.
- Run repository/use-case tests.

For cross-service changes:

- Verify every affected service.
- Check proto/event/docs alignment.

## Lint, format, build, test (repo root)

**Trước push** — khớp CI job `lint` + `build-test` (phải **0 warnings**):

```sh
pnpm run lint            # lint:ci = lint:deps + format:check + biome:check + lint:types
pnpm run build           # tsc / nest build — all packages
pnpm run test            # unit tests — all packages
```

| Script | Mô tả |
|--------|--------|
| `lint:deps` | Build `@collabspace/shared` + `@collabspace/nest-auth` trước ESLint |
| `format:check` | Biome format read-only |
| `biome:check` | Biome format + lint (`--error-on-warnings`) |
| `lint:types` | ESLint type-checked per package (`--max-warnings 0`) |
| `format` | Biome write |
| `biome:fix` | Biome auto-fix (review diff) |

**Per-service:** `pnpm run lint` = ESLint only; `pnpm run format` = Biome via `pnpm -w exec`. **Không** thay `pnpm run lint` ở root.

**Biome rules agents hay dính:** `noNonNullAssertion` (error) — không dùng `!`; narrow type hoặc guard. NestJS: `useImportType` off trong `biome.json`.

**ESLint:** `no-floating-promises` (error) — dùng `void bootstrap()` cho entrypoint async.

Pre-commit: `biome check --staged`. Details: `.claude/docs/development-workflows.md`, `docs/tooling/biome-migration.md`.

## Commands

Auth:

```sh
cd services/auth-service
pnpm run build
pnpm run test
pnpm run test:e2e
```

User:

```sh
cd services/user-service
pnpm run build
pnpm run test
pnpm run test:e2e
```

**Local Docker (Vault + stack — khuyến nghị):**

```powershell
.\scripts\docker-local-up.ps1 -Kafka          # built images (Dockerfile.service) — default
.\scripts\docker-local-up.ps1 -Kafka -Build   # rebuild sau đổi code
.\scripts\docker-local-up.ps1 -Dev            # hot-reload (override — chậm lúc start)
```

Hoặc `infrastructure\dev\dev.bat` (gọi `dev-mode.ps1` — cùng luồng Vault). Vault → `services/*/.env.vault` (secrets); `.env` chỉ config. **S2S:** cùng `SERVICE_JWT_SECRET` — xem `infrastructure/docker/.env.example`. Chi tiết: `infrastructure/vault/README.md`.

**Kafka migration E2E (Phase 3 + 4):**

```powershell
.\scripts\docker-local-up.ps1 -Kafka
.\scripts\register-workspace-outbox-connector.ps1
.\scripts\register-user-outbox-connector.ps1
.\scripts\kafka-phase3-e2e.ps1
.\scripts\kafka-phase4-e2e.ps1
```

Thủ công (không dùng script gộp):

```sh
cd infrastructure/docker
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Grafana: `http://localhost:3005` (admin / `collabspace`). Prometheus: `http://localhost:9090`.

Health checks:

```sh
curl http://localhost:3000/api/v1/auth/health
curl http://localhost:3001/api/v1/users/health
curl http://localhost:3006/api/v1/dlq/health/ready
```

Seed:

```sh
cd services/auth-service && pnpm run seed
cd ../user-service && pnpm run seed
cd ../workspace-service && pnpm run seed
cd ../task-service && pnpm run seed
cd ../notification-service && pnpm run seed

# or
sh ./scripts/seed.sh
```

K8s / production observability (after Helm deploy):

- Grafana: `http://<HOST>/grafana/` — dashboards folder **CollabSpace**
- k6 smoke: `BASE_URL=http://<HOST>/api/v1 ./infrastructure/deploy/run-k6-smoke-prod.sh`
- Guide: [docs/observability.md](../../docs/observability.md)

**DigitalOcean production (DOKS 3-node SGP1) — sau push ảnh hưởng Docker/Helm:**

1. Đọc `.claude/docs/doks-operations.md` trước khi patch tay hoặc debug prod.
2. Health nhanh: `curl https://collabspace.ngocanh2005it.site/api/v1/<service>/health/ready` (expect **200**).
3. CI: `gh run list --workflow=docker-deploy.yml --limit 1` — build fail thường do Dockerfile monorepo; deploy fail thường do pod crash / probe 404 / thiếu `NODE_PATH`.
4. Kubectl: `kubectl get pods -n collabspace`; `kubectl top nodes`; `kubectl top pods -n collabspace`; `kubectl logs deploy/<service> --tail=40`. KUBECONFIG từ GitHub secret `KUBECONFIG_DOKS` (CI) hoặc `doctl kubernetes cluster kubeconfig save <cluster-id>` (local).
5. **PostgreSQL HA — CloudNativePG** (đã migration 2026-06-22): cluster `postgres`, pods `postgres-2/3/4`, service `postgres-rw` (writes) + `postgres-ro` (reads). `cloudnativepg.enabled=true` / `postgresql.enabled=false` / `renderCluster=false` trong values-prod.yaml. Exec vào postgres: `kubectl exec -n collabspace $(kubectl get cluster postgres -n collabspace -o jsonpath='{.status.currentPrimary}') -c postgres -- psql -U postgres`.
6. **Không** patch `kubectl` probe/env rồi bỏ quên — fix trong Helm chart / Dockerfile và push; hotfix tay bị `helm upgrade` ghi đè.

Trước push đổi `Dockerfile.service` hoặc workspace packages: chạy `pnpm run build` service + cân nhắc `docker build` smoke (xem droplet doc).

## Troubleshooting Rules

- If a command fails because dependencies are missing, say exactly which dependency is missing and which install command would fix it.
- If Docker is not running, do not pretend runtime verification succeeded.
- If Git is blocked by `safe.directory`, mention it separately; it does not block build/test.
- If a test failure is unrelated to the current change, report it clearly and avoid hiding it.

## Final Verification Summary

Report (typical code change — repo root):

1. `pnpm run lint` — pass/fail (0 warnings required).
2. `pnpm run build` — pass/fail.
3. `pnpm run test` — pass/fail.

Also report:

- Commands run.
- Pass/fail result.
- Any skipped verification and reason.
- Any manual health endpoint or runtime check performed.
