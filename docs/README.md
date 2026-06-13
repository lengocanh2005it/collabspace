# Tài liệu CollabSpace

Chỉ mục tài liệu dự án (tiếng Việt có dấu). Tài liệu kỹ thuật cho agent/dev (tiếng Anh): [`.claude/docs/`](../.claude/docs/).

## Sản phẩm & MVP

| Tài liệu | Mô tả |
|----------|--------|
| [features.md](./features.md) | Tính năng và trạng thái implement (nguồn chính) |
| [mvp-demo-scope.md](./mvp-demo-scope.md) | Phạm vi demo MVP và tiêu chí chấp nhận |

## Kiến trúc & hợp đồng

| Tài liệu | Mô tả |
|----------|--------|
| [api-routes.md](./api-routes.md) | Chỉ mục route HTTP (đọc nhanh) |
| [cross-service-data.md](./cross-service-data.md) | Dữ liệu xuyên service, read model |
| [trade-offs.md](./trade-offs.md) | Quyết định kiến trúc và đánh đổi |
| [nfrs.md](./nfrs.md) | Yêu cầu phi chức năng (NFR) |

## Triển khai & hạ tầng

| Tài liệu | Mô tả |
|----------|--------|
| [digitalocean-production-options.md](./digitalocean-production-options.md) | So sánh phương án DigitalOcean |
| [deployment-k3s-phases.md](./deployment-k3s-phases.md) | **Lộ trình production** — k3s + Helm + Vault + ESO (theo phase) |
| [deployment-droplet-ip-quickstart.md](./deployment-droplet-ip-quickstart.md) | **Quickstart IP-only** — Phase 0–3 một lần (không domain) |
| [../infrastructure/deploy/phase0-checklist.md](../infrastructure/deploy/phase0-checklist.md) | Checklist Phase 0 (Droplet, values-prod, secrets) |
| [../infrastructure/deploy/phase1-checklist.md](../infrastructure/deploy/phase1-checklist.md) | Checklist Phase 1 (bootstrap k3s) |
| [../infrastructure/deploy/phase2-checklist.md](../infrastructure/deploy/phase2-checklist.md) | Checklist Phase 2 (Vault + ESO) |
| [../infrastructure/deploy/phase3-checklist.md](../infrastructure/deploy/phase3-checklist.md) | Checklist Phase 3 (Helm deploy) |
| [../infrastructure/deploy/phase4-checklist.md](../infrastructure/deploy/phase4-checklist.md) | Checklist Phase 4 (CI/CD k3s) |
| [deployment-digitalocean-droplet.md](./deployment-digitalocean-droplet.md) | Deploy legacy Docker Compose trên Droplet |
| [production-hardening.md](./production-hardening.md) | Checklist cứng hóa production |
| [backup-policy.md](./backup-policy.md) | Chính sách backup & phục hồi |
| [tracing-setup.md](./tracing-setup.md) | Cấu hình distributed tracing |
| [resilience-overview.md](./resilience-overview.md) | Tổng quan design for failure |
| [observability.md](./observability.md) | **Grafana, Prometheus, Loki, k6** — dashboard & vận hành |

## Vận hành

| Tài liệu | Mô tả |
|----------|--------|
| [runbooks/README.md](./runbooks/README.md) | Runbook cho cảnh báo Prometheus |

## Backlog team

| Tài liệu | Mô tả |
|----------|--------|
| [team/application-backlog.md](./team/application-backlog.md) | Backlog ứng dụng |
| [team/admin-backlog.md](./team/admin-backlog.md) | Backlog Admin Platform API — owner **Võ Trung Tín** |
| [team/phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) | Backlog hạ tầng / DevOps |
