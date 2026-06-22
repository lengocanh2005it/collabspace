# MongoDB Replication trên DOKS

## Trạng thái hiện tại

| Thuộc tính | Giá trị |
|-----------|---------|
| Architecture | `replicaset` (Bitnami chart) |
| Replica set name | `rs0` |
| `replicaCount` | **1** — single-node RS, không có failover thực |
| Image | `bitnamilegacy/mongodb:8.0.4-debian-12-r0` |
| PVC | `datadir-mongo-0` — 8Gi / `do-block-storage` |
| Arbiter | `mongo-arbiter-0` đang chạy (1 pod, không data) |

Cluster đang chạy architecture `replicaset` nhưng chỉ 1 member → nếu `mongo-0` chết thì toàn bộ task/notification service mất kết nối.

---

## Kế hoạch nâng lên 2 replica + arbiter

### Tại sao 2+arbiter thay vì 3?

| Cấu hình | RAM request thêm | Failover | Ghi chú |
|----------|-----------------|----------|---------|
| `replicaCount: 2` + arbiter | ~256Mi (secondary) + ~64Mi (arbiter có sẵn) | ✅ primary chết → secondary tự lên | **Khuyến nghị** |
| `replicaCount: 3` | ~512Mi | ✅ tốt hơn | Overkill với cluster hiện tại |

### Kiểm tra capacity trước khi nâng (snapshot 2026-06-22)

| Node | CPU Request | RAM Request | Ghi chú |
|------|------------|-------------|---------|
| `pool-r0ba46mj2-3cyqf6` | 1582m / 1900m (83%) | 2609Mi / ~3000Mi (86%) | Cao — không nên schedule thêm |
| `pool-r0ba46mj2-3cyqfa` | 1197m / 1900m (63%) | 1511Mi / ~3000Mi (50%) | **Còn ~1500Mi** — schedule secondary vào đây |
| `pool-r0ba46mj2-3cyqfe` | 1497m / 1900m (78%) | 1969Mi / ~3000Mi (65%) | Trung bình |

Secondary MongoDB (256Mi request) sẽ được schedule vào `3cyqfa` — đủ thoải mái.

---

## Thay đổi cần làm

### 1. `values-prod.yaml`

```yaml
mongodb:
  architecture: replicaset
  replicaSetName: rs0
  replicaCount: 2          # tăng từ 1 → 2
  persistence:
    size: 8Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
  arbiter:
    enabled: true           # giữ nguyên (mặc định true)
    resources:
      requests:
        memory: 64Mi
        cpu: 50m
      limits:
        memory: 128Mi
        cpu: 100m
```

### 2. Helm upgrade

Tăng `replicaCount` trên StatefulSet là **immutable field** → cần `--force`:

```bash
helm upgrade collabspace infrastructure/helm/collabspace \
  -n collabspace \
  -f infrastructure/helm/collabspace/values-prod.yaml \
  --set global.externalSecrets.enabled=true \
  --force \
  --wait --timeout=5m
```

> **`--force` xóa và tạo lại StatefulSet** — `mongo-0` sẽ restart ~30–60s. Data an toàn vì PVC `datadir-mongo-0` giữ nguyên. Secondary `mongo-1` sẽ sync data từ primary sau khi join.

### 3. Verify sau upgrade

```bash
# Kiểm tra cả 2 pod + arbiter chạy
kubectl get pods -n collabspace | grep mongo

# Kiểm tra replica set status
kubectl exec -n collabspace mongo-0 -- mongosh \
  -u admin -p <password> --authenticationDatabase admin \
  --eval "rs.status()" | grep -E "name|stateStr|health"
```

Kết quả mong đợi:
```
mongo-0:27017   PRIMARY    health: 1
mongo-1:27017   SECONDARY  health: 1
mongo-arbiter-0:27017  ARBITER  health: 1
```

---

## Sau khi có replica: kết nối string

App hiện dùng `MONGO_URI` dạng:
```
mongodb://admin:<pass>@mongo-0.mongo-headless:27017,mongo-1.mongo-headless:27017/collabspace_task?replicaSet=rs0&authSource=admin
```

Bitnami chart tự inject URI đúng qua secret — không cần sửa app code nếu dùng hostname `mongo` (Service ClusterIP trỏ tới primary).

---

## Lịch sử

| Ngày | Người | Hành động | Kết quả |
|------|-------|-----------|---------|
| 2026-06-22 | Lê Ngọc Anh | Phân tích capacity, lập kế hoạch replica | Draft |
