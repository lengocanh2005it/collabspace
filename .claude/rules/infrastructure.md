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
- Health endpoints phải ổn định — Docker/k8s/load tests phụ thuộc chúng.
