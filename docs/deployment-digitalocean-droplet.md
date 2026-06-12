# Deploy CollabSpace to a DigitalOcean Droplet

This guide deploys the full Docker Compose stack to one Droplet:

- Traefik gateway on ports `80` and `443`
- Five NestJS services
- PostgreSQL, MongoDB, Redis, RabbitMQ
- Images built by GitHub Actions and pushed to GitHub Container Registry (GHCR)

Recommended Droplet for the full stack: Ubuntu 24.04 LTS, 4 vCPU, 8 GB RAM, 160 GB disk.

## 1. Bootstrap the Droplet

SSH into the Droplet:

```sh
ssh root@129.212.228.214
```

Run the bootstrap script with your Git repository URL:

```sh
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/infrastructure/deploy/droplet-bootstrap.sh -o /tmp/droplet-bootstrap.sh
bash /tmp/droplet-bootstrap.sh https://github.com/<owner>/<repo>.git
```

The script installs Docker, Git, UFW, opens ports `22`, `80`, `443`, and clones the repo to `/opt/collabspace`.

## 2. Configure secrets with Vault

For this Droplet setup, Vault is the secret source of truth. The NestJS apps still read environment variables, so the deploy script syncs Vault values into service `.env` files before Docker Compose starts.

For the Droplet, prefer the single-node persistent Vault Compose file:

```sh
cd /opt/collabspace/infrastructure/docker
docker compose -f docker-compose.vault.prod.yml up -d
cd /opt/collabspace
bash infrastructure/vault/scripts/init-prod-vault.sh
```

The init script prints a read-only `VAULT_TOKEN`. Put that token in `infrastructure/deploy/droplet.env`.

Create `infrastructure/vault/.env` and set production/demo values:

```sh
cp infrastructure/rabbitmq/.env.example infrastructure/rabbitmq/.env
cp infrastructure/deploy/droplet.env.example infrastructure/deploy/droplet.env
nano infrastructure/deploy/droplet.env
cp infrastructure/vault/.env.example infrastructure/vault/.env
nano infrastructure/vault/.env
```

Then seed Vault:

```sh
VAULT_TOKEN=<root-token-from-infrastructure/vault/.vault-prod-init.json> \
VAULT_KV_PATH=collabspace/prod \
  bash infrastructure/vault/scripts/seed-dev-secrets.sh
```

Keep these in `infrastructure/deploy/droplet.env`:

```sh
USE_VAULT_SYNC=true
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=<read-token-from-init-prod-vault.sh>
VAULT_KV_PATH=collabspace/prod
COLLABSPACE_IMAGE_REGISTRY=ghcr.io/<github-owner>
```

The deploy script will run `infrastructure/vault/scripts/sync-env-from-vault.sh`, which creates and updates:

- `services/auth-service/.env`
- `services/user-service/.env`
- `services/workspace-service/.env`
- `services/task-service/.env`
- `services/notification-service/.env`
- `infrastructure/rabbitmq/.env`
- `infrastructure/redis/.env`
- `infrastructure/redis/redis.conf`

Important production flags are also enforced by `docker-compose.prod.yml`:

- Set `NODE_ENV=production` in all service `.env` files.
- Set `ALLOW_DEV_IDENTITY_HEADERS=false` in workspace/task/notification.
- Set `DATABASE_SYNCHRONIZE=false` in workspace.
- Use the same `INTERNAL_SERVICE_TOKEN` in user/workspace/task/notification.
- Keep `WORKSPACE_CLIENT_MODE=http` in task-service.
- Keep `RUN_MIGRATIONS=true` for normal deploys.
- Set `RUN_SEED=true` only when you want demo data loaded on the Droplet.

For a quick class demo only, `docker-compose.vault.yml` is still available, but it runs Vault `-dev` mode. Do not use dev mode for long-lived data.

For real long-lived production, use Vault HA or a managed secret manager, then keep the same `USE_VAULT_SYNC=true` flow with a non-root read token.

## 3. Configure GitHub secrets

In GitHub: repository `Settings` -> `Secrets and variables` -> `Actions`, add:

| Secret | Value |
|--------|-------|
| `DROPLET_HOST` | `129.212.228.214` |
| `DROPLET_USER` | `root` |
| `DROPLET_SSH_KEY` | Private key that can SSH into the Droplet |
| `GHCR_USERNAME` | GitHub username or org bot username |
| `GHCR_TOKEN` | GitHub PAT with `read:packages`; add `write:packages` if not using `GITHUB_TOKEN` for builds |

The workflow uses `GITHUB_TOKEN` to push images to GHCR. The Droplet uses `GHCR_TOKEN` to pull private GHCR images. If you make GHCR packages public, `GHCR_USERNAME` and `GHCR_TOKEN` are optional.

## 4. Deploy

Push to `main`, or run the workflow manually:

```text
Actions -> Build Images And Deploy -> Run workflow
```

Manual deploy from the Droplet is also supported:

```sh
cd /opt/collabspace
bash infrastructure/deploy/droplet-deploy.sh
```

## 5. Verify

On the Droplet:

```sh
docker ps
curl http://localhost/api/v1/auth/health
curl http://localhost/api/v1/auth/health/ready
```

From your machine:

```sh
curl http://129.212.228.214/api/v1/auth/health
```

Run the MVP smoke test:

```sh
cd /opt/collabspace
BASE_URL=http://localhost/api/v1 ./scripts/demo-e2e.sh
```

## Notes

- Keep the DigitalOcean firewall or UFW restricted to `22`, `80`, `443`.
- Do not expose Traefik dashboard port `8080` publicly.
- Use DigitalOcean automated backups for machine-level rollback, and database dump scripts under `infrastructure/backup/scripts/` for DB-level backup/restore demos.
