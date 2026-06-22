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
| `replicaCount: 2` + arbiter | ~256Mi thêm cho secondary; arbiter đã chạy sẵn với 128Mi request | ✅ primary chết → secondary tự lên | **Khuyến nghị** |
| `replicaCount: 3` | ~512Mi | ✅ tốt hơn | Overkill với cluster hiện tại |

### Kiểm tra capacity trước khi nâng (snapshot 2026-06-22 15:37 ICT)

Nguồn đo:

```bash
kubectl top nodes
kubectl top pods -n collabspace
kubectl describe nodes
kubectl get pods -n collabspace -o wide
```

`kubectl top` cho biết CPU/RAM đang dùng thực tế; `kubectl describe nodes`
cho biết requests mà scheduler dùng khi quyết định pod có bị `Pending` vì
`Insufficient cpu`/memory hay không.

| Node | CPU dùng thực | RAM dùng thực | CPU request | RAM request | Ghi chú |
|------|---------------|---------------|-------------|-------------|---------|
| `pool-r0ba46mj2-3cyqf6` | 739m / 1900m (38%) | 2171Mi (72%) | 1522m / 1900m (80%) | 2193Mi / ~3000Mi (73%) | Đang chạy `kafka-0`, `redis-master-0`, `workspace-service`, `postgres-3`, `mongo-arbiter-0`, `vault-0` |
| `pool-r0ba46mj2-3cyqfa` | 493m / 1900m (25%) | 2346Mi (78%) | 1532m / 1900m (80%) | 2343Mi / ~3000Mi (78%) | Đang chạy `mongo-0`, `debezium-connect`, `grafana`, `loki`, `postgres-4`, `metrics-server`; memory cao nhất |
| `pool-r0ba46mj2-3cyqfe` | 442m / 1900m (23%) | 2009Mi (66%) | 1322m / 1900m (69%) | 1937Mi / ~3000Mi (64%) | **Node còn headroom tốt nhất** cho Mongo secondary |

Mongo secondary theo values hiện tại cần khoảng `200m` CPU request và `256Mi`
RAM request. Nếu secondary được schedule vào `3cyqfe`, node đó tăng lên khoảng
`1522m / 1900m` CPU request (80%) và `2193Mi / ~3000Mi` RAM request (72%), vẫn
ổn hơn so với đặt thêm lên `3cyqfa` hoặc `3cyqf6`.

Khuyến nghị: khi nâng `replicaCount: 2`, theo dõi scheduler để `mongo-1` không
rơi vào `3cyqfa` nếu có thể. Nếu chart không có hard anti-affinity, dùng
`podAntiAffinity`/`topologySpreadConstraints` mềm để tách `mongo-0` và
`mongo-1` khác node, ưu tiên `3cyqfe`.

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
        memory: 128Mi
        cpu: 50m
      limits:
        memory: 256Mi
        cpu: 200m
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
| 2026-06-22 | Codex | Cập nhật snapshot DOKS sau khi có metrics-server và right-size CPU requests | Updated |
