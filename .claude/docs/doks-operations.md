# DigitalOcean Kubernetes — vận hành DOKS production (agents)

Hướng dẫn cho AI agents khi debug/deploy production trên **DOKS 3-node SGP1**. URL công khai: `docs/service-urls.md`.

> **Migration hoàn thành 2026-06-22.** Production đã chuyển từ Droplet k3s single-node sang DOKS. Droplet `167.172.77.110` không còn là production. Không còn dùng `/etc/rancher/k3s/k3s.yaml` hay SSH vào Droplet để vận hành.

## Trạng thái môi trường

| Mục | Giá trị |
|-----|---------|
| **Production** | **DOKS 3 worker nodes, SGP1** |
| Domain | `collabspace.ngocanh2005it.site` |
| KUBECONFIG | GitHub secret `KUBECONFIG_DOKS`; local: `doctl kubernetes cluster kubeconfig save <cluster-id>` |
| Namespace app | `collabspace` |
| Helm release | `collabspace` |
| Chart | `infrastructure/helm/collabspace` |
| Prod values (gitignored) | `infrastructure/helm/collabspace/values-prod.yaml` |
| **PostgreSQL** | **CloudNativePG** cluster `postgres` — pods `postgres-2/3/4`, `postgres-rw` (writes), `postgres-ro` (reads); `cloudnativepg.enabled=true` / `postgresql.enabled=false` / `renderCluster=false` |
| Metrics API | `metrics-server` installed from `infrastructure/k8s/metrics-server.yaml`; `kubectl top nodes` / `kubectl top pods -n collabspace` available |

**Không** đọc/commit `values-prod.yaml` hoặc in secret ra log/chat.

### Exec vào PostgreSQL

```bash
# Tìm primary pod động (không hardcode postgres-0):
PG_POD=$(kubectl get cluster postgres -n collabspace -o jsonpath='{.status.currentPrimary}')
kubectl exec -n collabspace "$PG_POD" -c postgres -- psql -U postgres -d collabspace_auth
```

### DOKS model

DOKS là managed Kubernetes: DigitalOcean quản lý control plane. CI deploy dùng `KUBECONFIG_DOKS` secret — không SSH vào Droplet nữa.

## CI/CD pipeline (per-service)

**Path filters:** `.github/path-filters.yml` — dùng chung cho `ci.yml` và `docker-deploy.yml`.

### CI (`ci.yml`) — mỗi PR / push `main`

- Chỉ chạy **lint + build + test** cho service có file đổi.
- PR chỉ sửa `docs/` → skip service CI (job `ci-gate` pass).
- Manual: **Actions → CI → Run workflow** — `services` rỗng = cả 7 app services.

### CD (`docker-deploy.yml`) — push `main` / dispatch

CI deploy trực tiếp vào DOKS qua GitHub secret `KUBECONFIG_DOKS` và chạy `helm upgrade`. Không còn SSH vào Droplet.

1. `detect-changes` → danh sách service cần build/deploy.
2. **Build matrix** — chỉ image của service đổi → GHCR tag **`{service}-{sha7}`**.
3. Existing release: wait datastores → run Postgres migrations for changed `auth/user/workspace` service images → `helm upgrade` app images once.
4. Fresh/forced full install: `helm upgrade --install` first, then wait datastores.
5. DB migration Jobs run when `auth/user/workspace` service is deployed or migration files change; manual dispatch still runs all three migration jobs.
6. Service **không** đổi giữ nguyên tag trong `values-prod.yaml`.

**Manual deploy một service:**

```text
Actions → Build Images And Deploy → Run workflow
  services: task-service
  image_tag: (để trống = task-service-<sha7>)
```

GitHub secrets cho DOKS target: `KUBECONFIG_DOKS`, `GHCR_USERNAME`, `GHCR_TOKEN`.

**Alertmanager → Slack:** `SLACK_ALERT_WEBHOOK_URL` trong Vault `slack_alert_webhook_url` → ESO `alertmanager-slack-secret`. Bật `observability.alertmanager.slack.enabled: true` trong `values-prod.yaml`.

**CloudNativePG migration:** follow `docs/cloudnativepg-migration.md`. Backup Bitnami first, then set `cloudnativepg.enabled: true` and `postgresql.enabled: false` in `values-prod.yaml`; Helm switches Postgres host wiring to `postgres-rw`. App/migration code builds `DATABASE_URL` from `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, and Secret `POSTGRES_PASSWORD`, URL-encoding the password at runtime. Debezium, postgres-exporter, and backup CronJob switch to `postgres-rw` automatically. If `cluster/postgres` already exists outside Helm ownership, keep `cloudnativepg.renderCluster=false`; CI detects that case and adds the override to avoid a Helm ownership conflict.

**Legacy Bitnami cleanup:** after CNPG is healthy and apps point to `postgres-rw`, run `CONFIRM_DELETE_LEGACY_POSTGRES=true infrastructure/deploy/cleanup-legacy-bitnami-postgres.sh`. The script deletes old Bitnami `statefulset/postgres`, `service/postgres`, `service/postgres-hl`, configmaps/secrets/PDB, and preserves `pvc/data-postgres-0` unless `DELETE_LEGACY_POSTGRES_PVC=true` is explicitly set.

**Vault seed:** phải có `BREVO_API_KEY` (auth-service crash nếu thiếu).

## Dev local ≠ image production (nguyên nhân hay gặp)

| Triệu chứng | Nguyên nhân thường gặp |
|-------------|------------------------|
| Pod `CrashLoopBackOff`, log rỗng hoặc exit ngay | Thiếu module runtime trong Docker image (`jsonwebtoken`, `@nestjs/common`) |
| Liveness/readiness **404** | Global prefix lệch: Helm/Traefik expect `/api/v1/...` |
| CI build fail ở `pnpm install` | Script `prepare` cần `git` — Dockerfile dùng `--ignore-scripts` |
| CI build fail ở `nest build` | Dockerfile thiếu copy/build `packages/nest-auth` |
| `timed out waiting for the condition` | Pod không Ready (crash hoặc probe fail) |
| Gateway **503** / `no available server` | Không pod Ready; Traefik không có backend |
| Pod `Pending` | PVC không bind — kiểm tra `storageClass: do-block-storage` |
| Postgres wait fails after CNPG migration | Check `kubectl get cluster postgres -n collabspace`; app writes should target `postgres-rw`, not the old Bitnami service |
| App sees `POSTGRES_PORT=tcp://...` | Legacy service-name injection or Kubernetes service links; Helm pins `POSTGRES_PORT=5432`, but remove legacy `service/postgres` after CNPG migration |
| `MONGO_URI` visible in ConfigMap | Bug — Mongo connection URLs must come from app Secret/ExternalSecret, not ConfigMap |

### Monorepo Docker — bắt buộc nhớ

Image NestJS dùng workspace packages (`@collabspace/shared`, `@collabspace/nest-auth`):

1. **Build stage:** copy + build cả `shared` và `nest-auth` trước service.
2. **Prod deps:** copy `packages/*/node_modules` vào runner (shared deps như `jsonwebtoken`).
3. **Runtime:** `NODE_PATH=/app/node_modules:/app/services/<service>/node_modules` — trong **Dockerfile ENV** và **Helm ConfigMap**.

## Health & probe contract

- Global prefix mọi NestJS HTTP service: **`/api/v1`**
- Probe paths (Helm `values.yaml`): `/api/v1/<area>/health/live` và `/ready`
- Traefik route: `PathPrefix(/api/v1/<area>)` — path tới pod **không** bị strip
- Sau đổi `main.ts` prefix hoặc controller path → verify **cả** probe Helm **và** gateway URL

## Lệnh chẩn đoán nhanh

```bash
# Pod status
kubectl get pods -n collabspace

# Actual CPU/memory usage
kubectl top nodes
kubectl top pods -n collabspace

# Pod + image tag
kubectl get deploy -n collabspace -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image

# Crash log
kubectl logs -n collabspace deploy/notification-service --tail=40
kubectl logs -n collabspace deploy/notification-service --previous --tail=40

# Probe path
kubectl get deploy notification-service -n collabspace -o jsonpath='{.spec.template.spec.containers[0].livenessProbe.httpGet.path}'

# NODE_PATH trong ConfigMap
kubectl get configmap notification-service-config -n collabspace -o jsonpath='{.data.NODE_PATH}'

# Events
kubectl describe pod -n collabspace -l app=notification-service | tail -20

# PVC status
kubectl get pvc -n collabspace

# CNPG status (after migration)
kubectl get cluster postgres -n collabspace
kubectl get pods -n collabspace -l cnpg.io/cluster=postgres
```

Từ máy ngoài:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://collabspace.ngocanh2005it.site/api/v1/notifications/health/live
```

## Rollout thủ công

```bash
# Từ máy local (kubeconfig đã setup)
cd E:\collabspace   # hoặc đường dẫn repo

helm upgrade --install collabspace infrastructure/helm/collabspace \
  --namespace collabspace \
  -f infrastructure/helm/collabspace/values-prod.yaml

# Xem rollout status
kubectl rollout status deployment/auth-service -n collabspace
```

Vault/ESO (khi đổi secret keys): apply `external-secrets.prod.yaml`, force ESO sync — xem `infrastructure/vault/README.md`.

**Reset data + migrate + seed:**

```bash
# Scale down apps
kubectl scale deployment --all --replicas=0 -n collabspace

# Sau khi wipe/migrate xong, scale lại
kubectl scale deployment --all --replicas=1 -n collabspace
```

## StorageClass

DOKS dùng `do-block-storage` cho tất cả PVC (PostgreSQL CNPG, MongoDB, Redis, Prometheus, Grafana). Nếu pod `Pending` do PVC:

```bash
kubectl describe pvc <pvc-name> -n collabspace
# Sửa storageClass trong values-prod.yaml rồi helm upgrade lại
```

## Vault unseal sau restart

Vault standalone cần unseal lại mỗi khi pod restart trên DOKS:

```bash
kubectl exec -n vault vault-0 -- vault operator unseal <unseal-key>
```

Giữ unseal key trong password manager — không commit vào repo.

## DOKS-specific — lưu ý

- Lấy kubeconfig: `doctl kubernetes cluster kubeconfig save <cluster-name>`
- Traefik service `LoadBalancer` sẽ tạo DigitalOcean Load Balancer và cấp IP mới; chỉ đổi DNS sau khi smoke test pass.
- `maxUnavailable: 0` + PDB `minAvailable: 1` — rollout an toàn khi drain node
- Kafka consumer (notification/task): cần `KAFKA_CONSUMERS_ENABLED=true` và broker reachable
- Debezium Connect + connectors: đăng ký sau khi Postgres/Mongo stack healthy
- Nếu PVC không bind trên DOKS, kiểm tra `storageClass: do-block-storage`.
- Với CloudNativePG, PVC thuộc các pod `postgres-1`, `postgres-2`, `postgres-3`; writes đi qua service `postgres-rw`.

## Liên quan

- URL & health công khai: `docs/service-urls.md`
- Helm: `infrastructure/helm/README.md`
- Resilience / readiness: `.claude/docs/resilience.md`
- Infra backlog: `docs/team/phan-phu-tho-infrastructure-backlog.md`
