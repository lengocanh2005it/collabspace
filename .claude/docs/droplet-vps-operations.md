# Droplet VPS — vận hành & troubleshooting (agents)

Hướng dẫn cho AI agents khi debug/deploy **production k3s trên DigitalOcean Droplet**. URL công khai: `docs/service-urls.md`.

## Thông tin cố định

| Mục | Giá trị |
|-----|---------|
| Host | `167.172.77.110` |
| SSH | `ssh root@167.172.77.110` (key-based; không hỏi password trong agent flow) |
| Repo trên VPS | `/opt/collabspace` |
| Kubeconfig | `/etc/rancher/k3s/k3s.yaml` |
| Namespace app | `collabspace` |
| Helm release | `collabspace` |
| Chart | `infrastructure/helm/collabspace` |
| Prod values (gitignored) | `infrastructure/helm/collabspace/values-prod.yaml` |
| Phase-0 secrets (gitignored) | `infrastructure/deploy/phase0.env` |

**Không** đọc/commit `phase0.env`, `values-prod.yaml`, hoặc in secret ra log/chat.

## CI/CD pipeline

1. Push `main` → `.github/workflows/docker-deploy.yml`
2. Build **cả 5** images (`infrastructure/docker/Dockerfile.service`) → cùng tag GHCR = commit SHA
3. SSH Droplet step 1 → `git-sync-private-repo.sh`
4. SSH Droplet step 2 → `helm-deploy-ci.sh` → `helm-rollout.sh` (một `IMAGE_TAG` cho cả 5 app; **không** migrate/seed)
5. (Tùy chọn) `workflow_dispatch` + `run_e2e=true` → `run-demo-e2e-prod.sh`

Helm-only push (chỉ chart/infra, không có `IMAGE_TAG` từ CI) → giữ tag image trong `values-prod.yaml` trên Droplet; mỗi push `main` vẫn build cả 5 image cùng commit SHA.

GitHub secrets cần có: `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`, `GHCR_USERNAME`, `GHCR_TOKEN`.

## Dev local ≠ image production (nguyên nhân hay gặp)

| Triệu chứng | Nguyên nhân thường gặp |
|-------------|------------------------|
| Pod `CrashLoopBackOff`, log rỗng hoặc exit ngay | Thiếu module runtime trong Docker image (`jsonwebtoken`, `@nestjs/common`) |
| Liveness/readiness **404** | Global prefix lệch: Helm/Traefik expect `/api/v1/...`, image cũ chỉ có `/api/...` |
| CI build fail ở `pnpm install` | Script `prepare` cần `git` — Dockerfile dùng `--ignore-scripts` |
| CI build fail ở `nest build` | Dockerfile thiếu copy/build `packages/nest-auth` |
| `timed out waiting for the condition` | Pod không Ready (crash hoặc probe fail); Helm upgrade ghi đè hotfix tay |
| Gateway **503** / `no available server` | Không pod Ready; Traefik không có backend |

### Monorepo Docker — bắt buộc nhớ

Image NestJS dùng workspace packages (`@collabspace/shared`, `@collabspace/nest-auth`):

1. **Build stage:** copy + build cả `shared` và `nest-auth` trước service.
2. **Prod deps:** copy `packages/*/node_modules` vào runner (shared deps như `jsonwebtoken`).
3. **Runtime:** `NODE_PATH=/app/node_modules:/app/services/<service>/node_modules` — trong **Dockerfile ENV** và **Helm ConfigMap** (`NODE_PATH` per service). Peer deps của `nest-auth` (`@nestjs/common`) nằm ở service `node_modules`, không tự resolve từ `packages/nest-auth/dist`.

**Không** patch `kubectl set env` / probe path tay rồi bỏ quên — lần `helm upgrade` sau sẽ ghi đè deployment (trừ khi đã vào chart).

## Health & probe contract

- Global prefix mọi NestJS HTTP service: **`/api/v1`**
- Probe paths (Helm `values.yaml`): `/api/v1/<area>/health/live` và `/ready`
- Traefik route: `PathPrefix(/api/v1/<area>)` — path tới pod **không** bị strip
- Sau đổi `main.ts` prefix hoặc controller path → verify **cả** probe Helm **và** gateway URL

## Lệnh chẩn đoán nhanh (SSH)

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Pod + image tag
kubectl get pods -n collabspace -l 'app in (auth-service,user-service,workspace-service,task-service,notification-service)'
kubectl get deploy -n collabspace -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image

# Crash log (pod đang restart)
kubectl logs -n collabspace deploy/notification-service --tail=40
kubectl logs -n collabspace deploy/notification-service --previous --tail=40

# Probe path trên deployment
kubectl get deploy notification-service -n collabspace -o jsonpath='{.spec.template.spec.containers[0].livenessProbe.httpGet.path}'

# NODE_PATH trong ConfigMap
kubectl get configmap notification-service-config -n collabspace -o jsonpath='{.data.NODE_PATH}'

# Rollout events
kubectl describe pod -n collabspace -l app=notification-service | tail -20
```

Từ máy ngoài:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://167.172.77.110/api/v1/notifications/health/live
```

## Rollout thủ công trên VPS

```bash
cd /opt/collabspace
git pull   # hoặc CI đã sync qua git-sync-private-repo.sh
export IMAGE_TAG=<commit-sha>
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
export IMAGE_TAG=<commit-sha>
# Chỉ khi có migration/schema mới:
# export RUN_K8S_MIGRATIONS=true
bash infrastructure/deploy/helm-rollout.sh
```

**CI workflow:** chỉ build image + Helm rollout. **Không** migrate, **không** seed từ GitHub Actions. Migration/seed chỉ chạy thủ công trên Droplet: `run-k8s-migrations.sh`, `run-k8s-seed.sh`, `run-k8s-full-reset.sh`.

Vault/ESO (khi đổi secret keys): `infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh`, apply `external-secrets.prod.yaml`, force ESO sync — xem `infrastructure/vault/README.md`.

**Reset data + migrate + seed (verbose):** `bash infrastructure/deploy/run-k8s-full-reset.sh` — wipe PG/Mongo/Redis, bootstrap auth/workspace schema, chạy migration Jobs với log mỗi 5s; fail thì in `kubectl logs` ngay. Chỉ migrate+seed: `SKIP_WIPE=true bash .../run-k8s-full-reset.sh`.

**Migration trong helm-rollout (tùy chọn):** `RUN_K8S_MIGRATIONS=true bash infrastructure/deploy/helm-rollout.sh` — scale down auth/user/workspace, chạy Jobs, restore replicas. Mặc định `false` (CI và deploy tay thường ngày).

## Trước khi push thay đổi ảnh hưởng deploy

1. `pnpm run build` service đích + `packages/shared` / `nest-auth` nếu đụng workspace.
2. (Khuyến nghị) Build smoke một image local:

```bash
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=notification-service \
  -t collabspace-notification-service:smoke .
docker run --rm -e SERVICE_JWT_SECRET=test -e MONGO_URI=mongodb://localhost:27017/test \
  collabspace-notification-service:smoke node -e "require('@collabspace/shared')"
```

3. Đổi `Dockerfile.service`, Helm probe, hoặc `main.ts` prefix → cập nhật doc này / `development-workflows.md` nếu quy trình đổi.

## Single-node k3s — hạn chế

- `maxUnavailable: 0` + 1 node → rollout chậm; pod cũ có thể kẹt `Terminating`
- `helm-rollout.sh` có `prune_stuck_terminating_pods` — vẫn có thể timeout nếu pod mới crash loop
- Notification consumer + RabbitMQ: rollout **sau** các service khác (script đã làm vậy)
- `reconcile-rabbitmq-queues.sh` chạy trong rollout: đảm bảo `collabspace_exchange`, `collabspace_dlx`, các service DLQ, binding `notification-service` cho `task_assigned`, `workspace_invited`, `workspace_deleted`, `comment_created`, `comment_mentioned`, `user_registered`, `user_profile_updated`, và binding `task-service` cho `workspace_deleted`, `user_registered`, `user_profile_updated`. Script gọi RabbitMQ Management API từ trong pod và lấy credential từ env pod; không in secret ra log.

## Liên quan

- URL & health công khai: `docs/service-urls.md`
- Phase deploy: `docs/deployment-k3s-phases.md`
- Helm: `infrastructure/helm/README.md`
- Resilience / readiness: `.claude/docs/resilience.md`
