# Quản lý Secrets — Local & Production

## Nguyên tắc

App code không biết Vault tồn tại — tất cả service chỉ đọc `process.env`.  
Vault là nguồn sự thật duy nhất cho secrets; `.env` files (local) và K8s Secrets (prod) chỉ là bản sao được sync từ Vault.

```
Local:       Vault dev  →  sync script  →  services/*/.env  →  Docker Compose  →  process.env
Production:  Vault pod  →  ESO (1h)     →  K8s Secret       →  Pod envFrom     →  process.env
```

---

## Secrets được quản lý bởi Vault

| Vault key | Env var | Service dùng |
|-----------|---------|--------------|
| `jwt_secret` | `JWT_SECRET` | auth, notification |
| `internal_service_token` | `INTERNAL_SERVICE_TOKEN` | user, workspace, task, notification |
| `postgres_password` | trong `DATABASE_URL` | auth, user, workspace |
| `mongo_username` / `mongo_password` | trong `MONGO_URI` | task, notification |
| `redis_password` | `REDIS_PASSWORD` | auth, notification |
| `rabbitmq_username` / `rabbitmq_password` | trong `RABBITMQ_URL` | tất cả |
| `metrics_auth_token` | `METRICS_AUTH_TOKEN` | tất cả |

Config không phải secret (PORT, host, grpc url...) vẫn nằm trong `.env` / ConfigMap — **Vault không quản lý**.

---

## Local Dev

### Lần đầu setup

**1. Khởi Vault dev container** (in-memory, auto-unseal):

```powershell
cd infrastructure/docker
docker compose -f docker-compose.vault.yml up -d
```

- UI: `http://localhost:8200`
- Root token: `collabspace-dev-root`

**2. Seed secrets vào Vault:**

```powershell
# Từ repo root
.\infrastructure\vault\scripts\seed-dev-secrets.ps1
```

Tạo path `secret/collabspace/dev` với tất cả keys mặc định.

**3. Sync Vault → `.env` files:**

```powershell
.\infrastructure\vault\scripts\sync-env-from-vault.ps1
```

Script đọc Vault rồi điền đè secret values vào `services/*/.env`.  
Các key non-secret (PORT, DATABASE_HOST...) không bị đụng đến.

**4. Chạy stack bình thường:**

```powershell
cd infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

### Khi cần đổi secret local

```powershell
$env:VAULT_ADDR  = "http://localhost:8200"
$env:VAULT_TOKEN = "collabspace-dev-root"

# Đổi một key
vault kv patch secret/collabspace/dev jwt_secret="giá-trị-mới"

# Sync lại .env
.\infrastructure\vault\scripts\sync-env-from-vault.ps1

# Restart service bị ảnh hưởng
cd infrastructure/docker
docker compose restart auth-service notification-service
```

### Lưu ý

- Vault dev mode **mất data khi `docker compose down`** — phải seed lại từ bước 2.
- Nếu muốn persistent ở local, dùng `docker-compose.vault.prod.yml` thay thế.
- Không commit file `.env` — đã có trong `.gitignore`.

---

## Production (Droplet / k3s)

### Kiến trúc hiện tại

```
Vault pod (vault-0, namespace: vault)
  └── secret/collabspace/prod
        ├── jwt_secret
        ├── internal_service_token
        ├── postgres_password
        ├── mongo_username / mongo_password
        ├── redis_password
        ├── rabbitmq_username / rabbitmq_password
        └── metrics_auth_token

External Secrets Operator (namespace: external-secrets)
  └── ClusterSecretStore: vault-collabspace
  └── ExternalSecret (mỗi service, refresh: 1h)
        └── K8s Secret: {service}-secrets  →  Pod envFrom  →  process.env
```

### Khi cần đổi secret production

```bash
# SSH vào Droplet
ssh root@167.172.77.110

# Lấy Vault token
export VAULT_TOKEN=$(jq -r '.root_token' \
  /opt/collabspace/infrastructure/vault/.vault-prod-init.json)
export VAULT_ADDR=http://vault.vault.svc.cluster.local:8200

# Đổi secret
vault kv patch secret/collabspace/prod jwt_secret="giá-trị-mới"

# ESO tự sync sau tối đa 1h, hoặc force ngay:
kubectl annotate externalsecret auth-service-secrets \
  force-sync=$(date +%s) -n collabspace --overwrite
kubectl annotate externalsecret notification-service-secrets \
  force-sync=$(date +%s) -n collabspace --overwrite

# Restart pod để nhận secret mới
kubectl rollout restart deployment/auth-service \
  deployment/notification-service -n collabspace
```

### Kiểm tra trạng thái ESO

```bash
# Xem tất cả ExternalSecrets đã sync chưa
kubectl get externalsecrets -n collabspace

# Kết quả mong đợi: STATUS=SecretSynced, READY=True
```

---

## So sánh nhanh

| | Local | Production |
|---|---|---|
| Vault | Dev container (in-memory) | `vault-0` pod (persistent 5Gi) |
| Path | `secret/collabspace/dev` | `secret/collabspace/prod` |
| Sync cơ chế | Script thủ công | ESO tự động mỗi 1h |
| App đọc từ | `services/*/.env` | K8s Secret `{service}-secrets` |
| Mất data khi nào | `docker compose down` vault | Không mất (persistent volume) |

---

## Liên quan

- `infrastructure/vault/README.md` — chi tiết init, unseal, seed, ESO
- `infrastructure/vault/scripts/` — seed + sync scripts
- `infrastructure/helm/collabspace/values-prod.yaml` — `global.externalSecrets.enabled: true`
- `docs/production-hardening.md` — checklist bảo mật tổng thể
