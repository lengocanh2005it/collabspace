# Phase 3 — Checklist Deploy ứng dụng (Helm)

Sau Phase 2. Cần `values-prod.yaml` và image GHCR đã build (workflow `build-images`).

Lộ trình: [docs/deployment-k3s-phases.md](../../docs/deployment-k3s-phases.md).

## Trước khi chạy

- [ ] Phase 2 xong (`verify-phase2.sh` pass)
- [ ] `infrastructure/helm/collabspace/values-prod.yaml` đã tạo từ Phase 0
- [ ] Password trong `values-prod.yaml` **khớp** Vault `secret/collabspace/prod`
- [ ] Image GHCR tồn tại với tag trong `values-prod.yaml` (thường là commit SHA `main`)
- [ ] (Nếu GHCR private) `GHCR_TOKEN` trong `phase0.env` hoặc secret `ghcr-credentials` đã có

## Chạy trên Droplet

```bash
cd /opt/collabspace
git pull --ff-only
chmod +x infrastructure/deploy/helm-deploy-phase3.sh \
  infrastructure/deploy/run-k8s-migrations.sh \
  infrastructure/deploy/verify-phase3.sh \
  infrastructure/deploy/verify-k8s-readiness.sh
sudo bash infrastructure/deploy/helm-deploy-phase3.sh
```

Script sẽ:

1. Tạo/cập nhật `ghcr-credentials` (nếu có `GHCR_TOKEN`)
2. `helm upgrade --install` với `values.yaml` + `values-prod.yaml`
3. Chờ PostgreSQL / MongoDB / Redis / RabbitMQ Ready
4. Chạy migration Job: **auth-service → user-service → workspace-service**
5. Scale rollout 5 app services và chờ `rollout status`

## Kiểm tra

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods -n collabspace
kubectl get svc traefik -n collabspace

sudo bash infrastructure/deploy/verify-phase3.sh
```

- [ ] Tất cả pod app `Running`
- [ ] Traefik `EXTERNAL-IP` hoặc Node IP truy cập được port 80
- [ ] 5 endpoint `/health/ready` trả 200 qua gateway
- [ ] (Tùy chọn) `BASE_URL=http://<ip>/api/v1 ./scripts/demo-e2e.sh` pass

## Migration thủ công (nếu cần chạy lại)

```bash
sudo bash infrastructure/deploy/run-k8s-migrations.sh
kubectl rollout restart deployment/auth-service deployment/user-service deployment/workspace-service -n collabspace
```

Image production dùng `pnpm run migrate:prod` (`node dist/.../migrate.js`), không cần `ts-node`.

## Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| `ImagePullBackOff` | Kiểm tra `ghcr-credentials`, tag image, quyền package GHCR |
| App `CrashLoopBackOff` trước migrate | Chạy lại `run-k8s-migrations.sh` |
| Migration Job fail | `kubectl logs job/<name> -n collabspace`; kiểm tra `DATABASE_URL` / password Postgres |
| Readiness 503/000 | `kubectl describe pod`; ESO secret đã sync chưa (Phase 2) |
| OOM trên Droplet 8GB | Xác nhận `replicas: 1` trong `values-prod.yaml` |

## Cờ production quan trọng (đã trong values-prod.example)

- `ALLOW_DEV_IDENTITY_HEADERS=false` (workspace, task, notification)
- `DATABASE_SYNCHRONIZE=false` (workspace-service)
- `NODE_ENV=production`

**Xong Phase 3 →** [Phase 4 checklist](./phase4-checklist.md)
