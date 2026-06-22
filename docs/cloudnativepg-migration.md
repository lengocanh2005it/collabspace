# CloudNativePG Migration

Migrate PostgreSQL từ Bitnami StatefulSet sang CloudNativePG (CNPG) operator để có auto-failover thật sự trên DOKS.

## Tại sao CloudNativePG

| | Bitnami replication (hiện tại) | CloudNativePG |
|--|--|--|
| Auto-failover | ❌ Tay | ✅ ~30s tự động |
| Primary/replica services | 1 service | `postgres-rw` + `postgres-ro` |
| Backup tích hợp | Script riêng | WAL archiving + Scheduled backup |
| CNCF project | ❌ | ✅ Sandbox |
| Độ phức tạp setup | Thấp | Trung bình |

## Kiến trúc sau migration

```
                    ┌─────────────────────────────────┐
                    │        CNPG Cluster CRD         │
                    │  instances: 3                   │
                    └────────────┬────────────────────┘
                                 │ operator quản lý
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        postgres-1          postgres-2          postgres-3
        (primary)           (replica)           (replica)
              │                  │                  │
              └──────────────────┴──────────────────┘
                         streaming replication
                         
    Service: postgres-rw  ──► primary (writes)
    Service: postgres-ro  ──► replica round-robin (reads)
    
    Failover: primary chết → CNPG operator bầu replica mới → ~30s
```

## Các bước thực hiện

### Bước 1 — Cài CNPG operator

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --create-namespace \
  --version 0.22.0
```

Verify:
```bash
kubectl get pods -n cnpg-system
# cnpg-cloudnative-pg-... Running
```

### Bước 2 — Backup data từ Bitnami postgres

```bash
# Dump toàn bộ databases từ postgres-0 hiện tại
kubectl exec -n collabspace postgres-0 -- \
  pg_dumpall -U postgres > /tmp/collabspace-pgdump-$(date +%Y%m%d).sql

# Verify file dump
wc -l /tmp/collabspace-pgdump-*.sql
```

### Bước 3 — Tạo CNPG Cluster manifest

File: `infrastructure/k8s/postgres-cluster.yaml`

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres
  namespace: collabspace
spec:
  instances: 3

  storage:
    size: 8Gi
    storageClass: do-block-storage

  postgresql:
    pg_hba:
      - host all all 0.0.0.0/0 md5

  bootstrap:
    initdb:
      database: collabspace_auth
      owner: postgres
      secret:
        name: postgres-superuser
      postInitSQL:
        - CREATE DATABASE collabspace_user;
        - CREATE DATABASE collabspace_workspace;

  superuserSecret:
    name: postgres-superuser

  resources:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
```

Secret cho superuser:
```bash
kubectl create secret generic postgres-superuser \
  -n collabspace \
  --from-literal=username=postgres \
  --from-literal=password="<POSTGRES_PASSWORD>"
```

### Bước 4 — Stop Bitnami PostgreSQL, apply CNPG Cluster

```bash
# Scale down apps để tránh write conflict
kubectl scale deployment auth-service user-service workspace-service \
  -n collabspace --replicas=0

# Uninstall Bitnami postgres (giữ PVC để backup, xóa sau)
helm upgrade collabspace infrastructure/helm/collabspace \
  --reuse-values \
  --set postgresql.enabled=false \
  -n collabspace

# Apply CNPG cluster
kubectl apply -f infrastructure/k8s/postgres-cluster.yaml

# Chờ cluster ready (3 instances)
kubectl wait cluster/postgres -n collabspace \
  --for=condition=Ready --timeout=10m
```

### Bước 5 — Restore data

```bash
# Copy dump vào primary pod
kubectl cp /tmp/collabspace-pgdump-*.sql \
  collabspace/postgres-1:/tmp/dump.sql

# Restore
kubectl exec -n collabspace postgres-1 -- \
  psql -U postgres -f /tmp/dump.sql
```

### Bước 6 — Cập nhật DATABASE_URL trong ConfigMaps

CNPG tạo 2 services:
- `postgres-rw` — primary, dùng cho writes (migrations, app writes)
- `postgres-ro` — replica, dùng cho reads

Cập nhật `values-prod.yaml` (không commit):
```yaml
cloudnativepg:
  enabled: true
  # true cho fresh install do Helm quản lý Cluster.
  # false nếu Cluster đã tồn tại ngoài Helm, ví dụ DOKS migration 2026-06-22
  # tạo bằng raw API do client local không discover được CNPG RESTMapper.
  renderCluster: false
  clusterName: postgres

# Thay thế/tắt Bitnami chart:
postgresql:
  enabled: false   # tắt Bitnami chart
```

Cập nhật migration Jobs trong workflow:
```yaml
# configMapRef: auth-service-config vẫn dùng được
# Helm helper tự render DATABASE_URL trỏ tới postgres-rw khi cloudnativepg.enabled=true
```

Đã có wiring trong Helm chart:
- `cloudnativepg.enabled=true` render CNPG `Cluster` và optional `ScheduledBackup`.
- `cloudnativepg.renderCluster=false` vẫn tạo/sync `postgres-superuser` Secret và chuyển app sang `postgres-rw`, nhưng không cố tạo lại `Cluster`.
- `collabspace.postgresql.host` tự chuyển từ `postgres` sang `postgres-rw`.
- App ConfigMaps, Debezium connectors, postgres-exporter và backup CronJob dùng helper host này.

### Bước 7 — Scale apps lên lại, verify

```bash
kubectl scale deployment auth-service user-service workspace-service \
  -n collabspace --replicas=2

# Verify replication
kubectl exec -n collabspace postgres-1 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication;"
# Phải thấy 2 rows (2 replicas đang stream)
```

### Bước 8 — Test auto-failover

Dùng script `scripts/demo-pg-failover.sh` — nó tự verify đầy đủ thay vì chạy lệnh rời:

```bash
# Demo có dừng xác nhận (gõ 'yes' để tiếp tục)
bash scripts/demo-pg-failover.sh

# Demo chạy thẳng không hỏi (live demo)
bash scripts/demo-pg-failover.sh --yes

# Dùng kubeconfig cụ thể
bash scripts/demo-pg-failover.sh --kubeconfig ~/.kube/doks --yes
```

Script tự động:

1. Pre-flight gate — abort nếu cluster chưa `3/3` ready (tránh rủi ro mất data).
2. Ghi 1 marker row vào primary trước khi xóa → chứng minh data không mất sau failover.
3. Xóa primary pod → CNPG **tự promote** replica (không cần `pg_ctl promote` thủ công).
4. Đo thời gian từ lúc xóa pod tới lúc primary mới được promote (~10-30s).
5. Verify primary mới writable + marker cũ còn nguyên.
6. Chờ pod cũ rejoin thành replica → cluster về `3/3`.
7. Verify public API trả 200 + Debezium connectors reconnect tới primary mới.

> ⚠️ **Đây là thao tác chủ động tác động prod.** Writes có thể fail vài giây trong lúc
> promote; reads qua `postgres-ro` không bị ảnh hưởng. Chạy lúc vắng / không đang demo live.

## Tích hợp với GitHub Actions workflow

Workflow `.github/workflows/docker-deploy.yml` đã có:

- Detect `cloudnativepg.enabled` từ `values-prod.yaml`.
- Cài/upgrade CNPG operator chart `cnpg/cloudnative-pg` version `0.22.0` khi flag bật.
- Nếu `cluster/postgres` đã tồn tại nhưng không do Helm release `collabspace` quản lý, workflow tự thêm `--set cloudnativepg.renderCluster=false` để deploy sau không fail vì resource ownership.
- Chờ CNPG Ready bằng Kubernetes raw API khi dùng CNPG, fallback về `statefulset/postgres` khi vẫn dùng Bitnami.

Logic tương đương:

```bash
# Thay:
kubectl rollout status statefulset/postgres -n collabspace --timeout=10m

# Thành:
kubectl get --raw \
  /apis/postgresql.cnpg.io/v1/namespaces/collabspace/clusters/postgres
```

Migration Jobs vẫn dùng `configMapRef: auth-service-config` — chỉ cần đảm bảo `DATABASE_HOST` trong ConfigMap trỏ về `postgres-rw`.

## Scheduled Backup (tích hợp CNPG)

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: postgres-daily
  namespace: collabspace
spec:
  schedule: "0 2 * * *"
  cluster:
    name: postgres
  backupOwnerReference: self
```

## Rollback plan

Nếu CNPG có vấn đề, rollback về Bitnami:

1. Scale down apps
2. `kubectl delete -f infrastructure/k8s/postgres-cluster.yaml`
3. Re-enable `postgresql.enabled: true` trong values-prod.yaml
4. Restore từ dump file
5. Scale up apps

## Chi phí thêm

- CNPG operator: **$0** (open source)
- 3 PVC × 8Gi × do-block-storage: ~$1.20/tháng thêm (so với 1 PVC hiện tại)
- 3 instances PostgreSQL: tốn thêm ~384Mi RAM tổng (2 replica × 128Mi minimum)

## Trạng thái

- [x] Cài CNPG operator lên DOKS qua GitHub Actions khi `cloudnativepg.enabled=true`
- [x] Backup data Bitnami
- [x] Tạo `infrastructure/k8s/postgres-cluster.yaml`
- [x] Migrate data
- [x] Cập nhật Helm ConfigMaps + `values-prod.example.yaml`
- [x] Script failover demo (`scripts/demo-pg-failover.sh`) — sẵn sàng
- [ ] Chạy failover test trên prod (thao tác chủ động — chờ thời điểm demo)
- [x] Cập nhật GitHub Actions workflow
