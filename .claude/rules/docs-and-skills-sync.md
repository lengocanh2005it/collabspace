---
paths:
  - "services/**"
  - "infrastructure/**"
  - "api-gateway/**"
  - "scripts/**"
---

# Docs & skills sync (bắt buộc khi cần)

Khi sửa code mà **ảnh hưởng hành vi, contract, hoặc cách vận hành**, cập nhật **cùng PR** các agent docs và skills liên quan — không để doc/skill lệch code.

## Khi nào phải sync

| Thay đổi code | Cập nhật tối thiểu |
|----------------|-------------------|
| HTTP route, DTO, status/error code | `.claude/docs/service-contracts.md`, `docs/api-routes.md` |
| gRPC proto / message | `service-contracts.md`, proto comments, consumer service docs |
| RabbitMQ event payload / tên event | `service-contracts.md`, `docs/cross-service-data.md` nếu replica/read model |
| Env var mới / đổi tên / bắt buộc | `services/*/.env.example`, `infrastructure/docker/.env.example`, `infrastructure/vault/.env.example`, Helm nếu deploy |
| Vault / ESO / shared secret keys | `infrastructure/vault/README.md`, `infrastructure/vault/k8s/`, `docs/production-hardening.md`, seed/sync scripts |
| Auth, trust boundary, internal API | `docs/production-hardening.md`, `service-contracts.md`, `docs/trade-offs.md` nếu quyết định mới |
| Health / readiness / degradation | `.claude/docs/resilience.md`, `docs/resilience-overview.md` |
| Grafana / Prometheus / Loki / k6 / dashboards | `docs/observability.md`, `infrastructure/helm/README.md`, `infrastructure/load-testing/README.md`, `.claude/docs/development-workflows.md` |
| Tính năng Done / Planned / Partial | `docs/features.md`, `docs/mvp-demo-scope.md`, `.claude/docs/mvp-roadmap.md` |
| Backlog team đóng mục | `docs/team/application-backlog.md` hoặc `phan-phu-tho-infrastructure-backlog.md` |
| Port, global prefix, gateway route | `CLAUDE.md`, `api-gateway/`, `README.md` nếu quick start đổi |
| Pattern lặp lại trong một service | `services/<service>/CLAUDE.md`, `.claude/rules/<service>.md` |
| Workflow verify / migrate / seed đổi | `.claude/docs/development-workflows.md`, skill `/local-dev-verify` nếu bước verify đổi |
| Docker/K8s Droplet deploy, rollout, probe, NODE_PATH | `.claude/docs/droplet-vps-operations.md`, `.claude/rules/infrastructure.md`, skill `/local-dev-verify` |
| Quy trình implement NestJS đổi | `.claude/skills/nest-service-change/SKILL.md` (nếu áp dụng rộng) → chạy `scripts/sync-agent-docs.sh` |
| Skill workflow đổi (bất kỳ) | `.claude/skills/*/SKILL.md` → `scripts/sync-agent-docs.sh` → `.agents/skills/` |
| Subagent prompt đổi | `.claude/agents/*.md` + `.codex/agents/*.toml` (cùng PR, sync tay) |

Chỉ refactor nội bộ (rename private helper, format) **không** đổi contract → không bắt buộc sync doc.

## Thứ tự làm

1. Sửa code + test.
2. Rà bảng trên; cập nhật doc/skill **trong cùng thay đổi**.
3. Trong completion message: liệt kê file doc/skill đã cập nhật (hoặc ghi "không cần — không đổi contract").
4. Nếu sửa `.claude/skills/`: chạy `scripts/sync-agent-docs.sh` (hoặc `.ps1`) để mirror Codex `.agents/skills/`.

Chi tiết: `.claude/docs/agent-onboarding.md` → **Docs & skills sync**.
