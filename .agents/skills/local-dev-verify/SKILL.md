---
name: local-dev-verify
description: Choose and run the right local build, test, migration, seed, Docker, health check, or troubleshooting workflow for CollabSpace. Use when verifying changes, debugging local setup, checking health endpoints, or preparing a demo.
---

# Local Dev Verify Skill

Use this skill to verify code changes and local runtime behavior.

## Required Context

Read:

- `.claude/docs/development-workflows.md`
- **Production Droplet / k3s:** `.claude/docs/droplet-vps-operations.md` (when debugging VPS, CI deploy, rollout timeout, probe 404)
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

Optional Vault (shared secrets → service `.env`):

```powershell
cd infrastructure/docker
docker compose -f docker-compose.vault.yml up -d
cd ../..
.\infrastructure\vault\scripts\seed-dev-secrets.ps1
.\infrastructure\vault\scripts\sync-env-from-vault.ps1
```

Vault seeds `jwt_secret` + `service_jwt_secret` (và DB/RabbitMQ/Redis). **S2S HTTP:** cùng `SERVICE_JWT_SECRET` trên user, workspace, task, notification — xem `infrastructure/docker/.env.example`.

See `infrastructure/vault/README.md`.

Core Docker stack:

```sh
cd infrastructure/docker
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Health checks:

```sh
curl http://localhost:3000/api/v1/auth/health
curl http://localhost:3001/api/v1/users/health
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

**Droplet VPS (`167.172.77.110`) — sau push ảnh hưởng Docker/Helm:**

1. Đọc `.claude/docs/droplet-vps-operations.md` trước khi SSH/patch tay.
2. Health nhanh: `curl http://167.172.77.110/api/v1/<service>/health/live` (expect **200**).
3. CI: `gh run list --workflow=docker-deploy.yml --limit 1` — build fail thường do Dockerfile monorepo; deploy fail thường do pod crash / probe 404 / thiếu `NODE_PATH`.
4. SSH: `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml`; `kubectl get pods -n collabspace`; `kubectl logs deploy/<service> --tail=40`.
5. **Không** patch `kubectl` probe/env rồi bỏ quên — fix trong Helm chart / Dockerfile và push; hotfix tay bị `helm upgrade` ghi đè.

Trước push đổi `Dockerfile.service` hoặc workspace packages: chạy `pnpm run build` service + cân nhắc `docker build` smoke (xem droplet doc).

## Troubleshooting Rules

- If a command fails because dependencies are missing, say exactly which dependency is missing and which install command would fix it.
- If Docker is not running, do not pretend runtime verification succeeded.
- If Git is blocked by `safe.directory`, mention it separately; it does not block build/test.
- If a test failure is unrelated to the current change, report it clearly and avoid hiding it.

## Final Verification Summary

Report:

- Commands run.
- Pass/fail result.
- Any skipped verification and reason.
- Any manual health endpoint or runtime check performed.

