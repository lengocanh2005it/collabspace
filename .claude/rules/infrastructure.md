---
paths:
  - "infrastructure/**"
  - "api-gateway/**"
---

# Infrastructure Rules

- Docker Compose từ `infrastructure/docker`; core stack:
  `docker-compose.yml` + `docker-compose.db.yml` + `docker-compose.override.yml`.
- Port mapping local:
  - auth `3000`, user `3001`, workspace `3002`→`8080`, task `3003`, notification `3004`.
- Đổi route Traefik → đồng bộ `api-gateway/dynamic`, `k8s/ingress.yaml`, Helm `ingressroute.yaml`, service controllers, `docs/api-routes.md`.
- Trust boundaries: `strip-identity-headers`, block `/users/internal` + `/workspaces/internal` at gateway; K8s `network-policies.yaml`.
- Không commit secrets; cập nhật `.env.example` khi thêm env var.
- **HashiCorp Vault:** `infrastructure/vault/` — local `docker-compose.vault.yml`; K8s ESO manifests; đổi KV key → cập nhật seed scripts + `external-secrets.yaml` + `infrastructure/vault/README.md`.
- Helm: `global.externalSecrets.enabled` + `global.secrets.serviceJwtSecret` khi không dùng ESO.
- Health endpoints phải ổn định — Docker/k8s/load tests phụ thuộc chúng.
- **Droplet k3s:** global prefix `/api/v1`; Helm probe paths phải khớp app; `NODE_PATH` trong ConfigMap + Dockerfile cho monorepo workspace — xem `.claude/docs/droplet-vps-operations.md`.
- `Dockerfile.service`: `--ignore-scripts` khi `pnpm install`; build `shared` + `nest-auth`; copy `packages/*/node_modules` vào runner.
