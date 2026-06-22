# HashiCorp Vault — CollabSpace secrets

CollabSpace NestJS services read secrets from **environment variables**. Vault is the **source of truth**; apps are unchanged.

| Environment | Integration |
|-------------|-------------|
| **Local Docker** | **Khuyến nghị:** Vault dev (`docker-compose.vault.yml`) + `seed-dev-secrets` + `sync-env-from-vault` → `services/*/.env`. Hoặc điền tay dev credentials khớp `vault/.env.example`. |
| **Single Droplet** | Persistent single-node Vault container + `sync-env-from-vault` → `services/*/.env` |
| **Kubernetes** | Vault + [External Secrets Operator](https://external-secrets.io/) → `Secret` → `envFrom` (Helm) |

KV layout (v2 mount `secret/`):

```text
secret/collabspace/dev          # local / chart defaults
secret/collabspace/staging      # staging (same keys)
secret/collabspace/prod         # production
```

Keys in each path:

| Vault key | Env var(s) | Services |
|-----------|------------|----------|
| `jwt_secret` | `JWT_SECRET` | auth, notification |
| `service_jwt_secret` | `SERVICE_JWT_SECRET` | auth, user, workspace, task, notification, dlq, analytics (S2S HTTP) |
| `postgres_password` | `POSTGRES_PASSWORD`, `DATABASE_URL` | auth, user, workspace |
| `mongo_username` / `mongo_password` | `MONGO_URI` | task, notification, dlq, analytics |
| `redis_password` | `REDIS_PASSWORD` | auth, notification |
| `metrics_auth_token` | `METRICS_AUTH_TOKEN` | all five apps |
| `azure_storage_connection_string` | `AZURE_STORAGE_CONNECTION_STRING` | user-service (avatar), task-service (attachments) |
| `do_spaces_key` / `do_spaces_secret` | — (inject vào `backup-spaces-secret` qua ESO) | CronJob backup-postgres, backup-mongo |

Non-secret Azure config for task attachments (Helm ConfigMap, not Vault):

| Env var | Default | Service |
|---------|---------|---------|
| `AZURE_STORAGE_CONTAINER_NAME` | `task-attachments` | task-service |
| `AZURE_STORAGE_MAX_FILE_SIZE` | `5242880` | task-service |

---

## Local dev (Docker)

### 1. Start Vault (dev mode — in-memory, auto-unseal)

```powershell
cd infrastructure/docker
docker compose -f docker-compose.vault.yml up -d
```

- API / UI: http://localhost:8200  
- Root token (default): `collabspace-dev-root` — see `.env.example`

> **Warning:** `-dev` mode is for learning only. Data is lost when the container is removed.

### 2. Seed secrets

```powershell
# from repo root
.\infrastructure\vault\scripts\seed-dev-secrets.ps1
```

Linux/macOS:

```bash
chmod +x infrastructure/vault/scripts/*.sh
./infrastructure/vault/scripts/seed-dev-secrets.sh
```

Override defaults via `infrastructure/vault/.env` (copy from `.env.example`).

### 3. Sync Vault → `.env.vault` (secrets) — **không** ghi vào `.env`

```powershell
.\infrastructure\vault\scripts\strip-vault-secrets-from-env.ps1   # .env: secret fields empty
.\infrastructure\vault\scripts\sync-env-from-vault.ps1            # .env.vault: secrets from Vault
```

Hoặc một lệnh (seed từ `phase0.env` + strip + sync):

```powershell
.\infrastructure\vault\scripts\reset-local-env-from-vault.ps1
```

- `services/*/.env` — **chỉ config** (Kafka, outbox, ports…); field Vault-managed **để trống** hoặc `VAULT_SYNC` trong URL.
- `services/*/.env.vault` — gitignored; Docker Compose load sau `.env`.

### 4. Start the stack as usual

```powershell
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Local dev có thể dùng `.env` tay thay Vault dev container; **K8s prod bắt buộc Vault + ESO** (Phase 2 — `vault-eso-phase2.sh`).

---

## Single Droplet (persistent Vault)

For DigitalOcean Droplet demos/staging, use a persistent single-node Vault instead of dev mode:

```bash
cd infrastructure/docker
docker compose -f docker-compose.vault.prod.yml up -d
cd ../..
bash infrastructure/vault/scripts/init-prod-vault.sh
```

The init script:

1. Initializes Vault with one unseal key.
2. Saves init material to `infrastructure/vault/.vault-prod-init.json` (gitignored).
3. Unseals Vault.
4. Enables KV v2 at `secret/`.
5. Creates read-only policy `collabspace-prod-read`.
6. Creates a renewable read token and saves it to `infrastructure/vault/.vault-prod-read-token.json` (gitignored).

Seed the production path:

```bash
root_token=$(jq -r '.root_token' infrastructure/vault/.vault-prod-init.json)
VAULT_TOKEN="$root_token" VAULT_KV_PATH=collabspace/prod \
  bash infrastructure/vault/scripts/seed-dev-secrets.sh
```

Deploy sync should use the read token, not the root token:

```bash
read_token=$(jq -r '.auth.client_token' infrastructure/vault/.vault-prod-read-token.json)
```

Set `VAULT_TOKEN=$read_token` and `VAULT_KV_PATH=collabspace/prod` in `infrastructure/deploy/doks.env`.

This mode persists secrets in Docker volume `vault_file`, but it is still single-node, not HA.

---

## Kubernetes (staging / production)

### Architecture

```text
Vault (HA)
  → External Secrets Operator (ClusterSecretStore)
  → Kubernetes Secret: auth-service-secrets, …
  → Helm Deployment envFrom.secretRef
  → NestJS process.env
```

### 1. Install External Secrets Operator

Follow [ESO installation](https://external-secrets.io/latest/introduction/getting-started/) in your cluster.

### 2. Deploy Vault

Use your platform standard (Helm chart `hashicorp/vault`, Vault on VMs, HCP Vault, etc.). Enable **KV v2** at mount `secret/`.

Seed paths, e.g. `collabspace/prod`, with the same keys as dev (use `seed-dev-secrets` against prod `VAULT_ADDR` or `vault kv put`).

### 3. ESO auth to Vault

**Staging (token):**

```bash
kubectl create namespace collabspace
kubectl create secret generic vault-eso-token -n collabspace \
  --from-literal=token='<eso-read-token>'
kubectl apply -f infrastructure/vault/k8s/cluster-secret-store.yaml
```

**Production (recommended):** Kubernetes auth method on Vault + policy per ESO role (no long-lived root token). See [Vault K8s auth](https://developer.hashicorp.com/vault/docs/auth/kubernetes).

### 4. ExternalSecrets

- **Dev:** `infrastructure/vault/k8s/external-secrets.yaml` (`collabspace/dev`)
- **Prod k3s:** `infrastructure/vault/k8s/external-secrets.prod.yaml` (`collabspace/prod`)

Automated Phase 2 on Droplet: `infrastructure/deploy/vault-eso-phase2.sh` — see [deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md) (Phase 2).

```bash
kubectl apply -f infrastructure/vault/k8s/external-secrets.prod.yaml
kubectl get externalsecrets -n collabspace
```

### 5. Helm — disable chart-rendered secrets

```yaml
# values-prod.yaml
global:
  externalSecrets:
    enabled: true
    vaultKvPath: collabspace/prod
```

```bash
helm upgrade --install collabspace infrastructure/helm/collabspace \
  -n collabspace -f values.yaml -f values-prod.yaml
```

Helm still renders ConfigMaps (non-secret URLs). Keep Bitnami subchart passwords (`mongodb.auth.rootPassword`, etc.) aligned with Vault `mongo_password` / `postgres_password`.

---

## Rotation

| Secret | Notes |
|--------|--------|
| `service_jwt_secret` | Update Vault → ESO refresh → rolling restart user/workspace/task/notification |
| `jwt_secret` | Prefer dual-key signing in auth before revoking old key |
| DB passwords | Coordinate Vault, Bitnami charts, and rolling restart |

---

## Related docs

- `docs/production-hardening.md` — secrets checklist  
- `infrastructure/docker/.env.example` — shared dev values (should match Vault seed defaults)  
- `infrastructure/helm/README.md` — Helm install  
- `infrastructure/vault/policies/collabspace-dev-read.hcl` — read-only policy sample  
