# Phase 4 — Checklist CI/CD tự động (k3s + Helm)

Sau Phase 3 (cluster đã chạy ít nhất một lần). Push `main` → build image → deploy Helm qua SSH.

Lộ trình: [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md).

## Trước khi bật CI deploy

- [ ] Phase 1–3 đã chạy trên Droplet (`verify-phase3.sh` pass)
- [ ] `/opt/collabspace/infrastructure/helm/collabspace/values-prod.yaml` tồn tại trên server (không commit)
- [ ] `/opt/collabspace/infrastructure/deploy/phase0.env` tồn tại trên server (không commit)
- [ ] **Không sửa tay** file tracked trong `/opt/collabspace` (vd. `helm-rollout.sh`) — CI `git-sync` reset về `origin/main`; chỉ giữ local `phase0.env` + `values-prod.yaml`
- [ ] GitHub Secrets đã cấu hình (xem bảng dưới)
- [ ] Droplet có `git`, `kubectl`, `helm`, k3s đang chạy

## GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Bắt buộc | Mục đích |
|--------|----------|----------|
| `DROPLET_HOST` | ✅ | IP Droplet |
| `DROPLET_USER` | ✅ | User SSH (`root`) |
| `DROPLET_SSH_KEY` | ✅ | Private key SSH (full PEM) |
| `GHCR_USERNAME` | Nếu image private | Username GitHub / GHCR |
| `GHCR_TOKEN` | Nếu image private | PAT `read:packages` (cluster pull) |

Workflow: `.github/workflows/docker-deploy.yml`

> CI deploy applies Helm manifests first, then waits for datastores, runs migrations, and finally waits for app rollouts. This avoids deadlock when a fresh app image requires new tables before its readiness probe can pass.

## Pipeline

```text
push main (hoặc workflow_dispatch)
  → build-images (5 service → GHCR, tag = commit SHA)
  → deploy (SSH Droplet)
       → git pull
       → helm-deploy-ci.sh (helm apply + migration + rollout)
       → verify-k8s-readiness.sh
```

## Kiểm tra sau merge

1. GitHub Actions → workflow **Build Images And Deploy** → job `deploy` xanh
2. Trên Droplet:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods -n collabspace
kubectl get deployment -n collabspace -o wide
```

3. Readiness qua gateway:

```bash
sudo bash infrastructure/deploy/verify-k8s-readiness.sh
```

4. (Tùy chọn) MVP smoke nếu đã seed:

```bash
BASE_URL=http://<ip>/api/v1 ./scripts/demo-e2e.sh
```

## Deploy thủ công (workflow_dispatch)

Actions → **Build Images And Deploy** → **Run workflow** → nhập `image_tag` (hoặc để trống dùng SHA hiện tại).

## Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| `missing server host` | Thiếu `DROPLET_HOST` / `DROPLET_USER` / `DROPLET_SSH_KEY` |
| SSH timeout | Firewall port 22; IP đúng; key đúng user |
| `values-prod.yaml` missing | Chạy `prepare-prod-values.sh` trên Droplet (Phase 0) |
| `ImagePullBackOff` sau deploy | `GHCR_TOKEN` + `ghcr-credentials`; package public hoặc PAT |
| Migration job fail | `kubectl logs job/... -n collabspace`; schema đã migrate chưa |
| verify readiness FAIL | `kubectl describe pod`; Vault/ESO secrets (Phase 2) |

## Legacy Compose

`infrastructure/deploy/droplet-deploy.sh` **không** còn được CI gọi. Chỉ dùng cho demo Compose thủ công — xem [deployment-digitalocean-droplet.md](../../docs/deployment-digitalocean-droplet.md).

**Xong Phase 4 →** [Phase 5: Production hardening](../../docs/deployment-k3s-phases.md#phase-5--production-hardening)
