# DigitalOcean Kubernetes — vận hành & DOKS migration (agents)

Hướng dẫn cho AI agents khi debug/deploy production hiện tại trên **Droplet k3s single-node** và khi migration sang **DOKS 3 node**. URL công khai: `docs/service-urls.md`.

## Trạng thái môi trường

| Mục | Giá trị |
|-----|---------|
| Production hiện tại | Droplet k3s single-node (`167.172.77.110`) |
| Migration target | DOKS 3 worker nodes (SGP1), blue/green song song với Droplet |
| Domain | `collabspace.ngocanh2005it.site` |
| Namespace app | `collabspace` |
| Helm release | `collabspace` |
| Chart | `infrastructure/helm/collabspace` |
| Prod values (gitignored) | `infrastructure/helm/collabspace/values-prod.yaml` |
| DOKS PostgreSQL target | CloudNativePG cluster `postgres` (`postgres-rw` for writes, `postgres-ro` for reads) |

**Không** đọc/commit `values-prod.yaml` hoặc in secret ra log/chat.

## DOKS target model

DOKS là managed Kubernetes: DigitalOcean quản lý control plane. Nếu cần control plane HA, bật tùy chọn **HA control plane** của DOKS; nếu muốn tự quản lý control plane thật thì đó là mô hình kubeadm/k3s multi-node trên Droplet, không phải DOKS.

Migration khuyến nghị là **blue/green**:

1. Giữ Droplet k3s production đang chạy.
2. Tạo DOKS 3 node và lấy kubeconfig bằng `doctl kubernetes cluster kubeconfig save <cluster-name>`.
3. Cài Vault + ESO, seed lại `secret/collabspace/prod`.
4. Deploy Helm release `collabspace` lên DOKS. With `cloudnativepg.enabled=true`, GitHub Actions installs/upgrades the CNPG operator first, then Helm renders the `Cluster`.
5. Restore Postgres/Mongo nếu cần giữ data thật.
6. Smoke test qua DOKS LoadBalancer IP.
7. Đổi DNS sang DOKS LoadBalancer IP; giữ Droplet vài ngày để rollback.

## CI/CD pipeline (per-service)

**Path filters:** `.github/paths-filter.yml` — dùng chung cho `ci.yml` và `docker-deploy.yml`.

### CI (`ci.yml`) — mỗi PR / push `main`

- Chỉ chạy **lint + build + test** cho service có file đổi.
- PR chỉ sửa `docs/` → skip service CI (job `ci-gate` pass).
- Manual: **Actions → CI → Run workflow** — `services` rỗng = cả 5.

### CD (`docker-deploy.yml`) — push `main` / dispatch

Hiện tại production Droplet dùng SSH vào server rồi chạy Helm với kubeconfig k3s local. Sau migration sang DOKS, cập nhật workflow để dùng `KUBECONFIG_DOKS` secret và chạy `helm upgrade` trực tiếp vào DOKS thay vì SSH. Xem backlog: `docs/team/phan-phu-tho-infrastructure-backlog.md`.

1. `detect-changes` → danh sách service cần build/deploy.
2. **Build matrix** — chỉ image của service đổi → GHCR tag **`{service}-{sha7}`**.
3. `helm upgrade --install collabspace` với image tags mới.
4. Service **không** đổi giữ nguyên tag trong `values-prod.yaml`.

**Manual deploy một service:**

```text
Actions → Build Images And Deploy → Run workflow
  services: task-service
  image_tag: (để trống = task-service-<sha7>)
```

GitHub secrets cho DOKS target: `KUBECONFIG_DOKS`, `GHCR_USERNAME`, `GHCR_TOKEN`.

**Alertmanager → Slack:** `SLACK_ALERT_WEBHOOK_URL` trong Vault `slack_alert_webhook_url` → ESO `alertmanager-slack-secret`. Bật `observability.alertmanager.slack.enabled: true` trong `values-prod.yaml`.

**CloudNativePG migration:** follow `docs/cloudnativepg-migration.md`. Backup Bitnami first, then set `cloudnativepg.enabled: true` and `postgresql.enabled: false` in `values-prod.yaml`; Helm app ConfigMaps, Debezium, postgres-exporter, and backup CronJob switch to `postgres-rw` automatically. If `cluster/postgres` already exists outside Helm ownership, keep `cloudnativepg.renderCluster=false`; CI detects that case and adds the override to avoid a Helm ownership conflict.

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
curl -s -o /dev/null -w "%{http_code}\n" http://167.172.77.110/api/v1/notifications/health/live
# hoặc qua domain
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

Droplet k3s hiện dùng `local-path`. DOKS target phải dùng `do-block-storage` cho PVC. Nếu pod `Pending` do PVC:

```bash
kubectl describe pvc <pvc-name> -n collabspace
# Sửa storageClass trong values-prod.yaml rồi helm upgrade lại
```

## Vault unseal sau restart

Vault standalone cần unseal lại mỗi khi pod restart, cả trên Droplet k3s lẫn DOKS:

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
